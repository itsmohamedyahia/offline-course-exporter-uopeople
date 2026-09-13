#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UoPeople Course Exporter Companion Daemon
Standalone HTTP daemon running on port 4048 to handle:
1. Native desktop folder selection (Tkinter / PowerShell FolderBrowserDialog)
2. Automated course package unzipping & coursework folder initialization (POST /process-courses)
3. Reading/persisting user active courses configuration
Decoupled entirely from PushPopFlow.
"""

import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import os
import json
import time
import shutil
import threading
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

DEFAULT_PORT = 4048
CONFIG_FILE = Path.home() / ".uopeople_course_exporter_config.json"
SCRIPT_DIR = Path(__file__).resolve().parent
PROCESSOR_SCRIPT = SCRIPT_DIR / "process_active_courses.py"


def get_stored_config():
    """Reads stored active courses configuration from disk."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Warning] Could not read daemon config: {e}")
    return {}


def save_stored_config(data):
    """Saves active courses configuration to disk."""
    try:
        current = get_stored_config()
        current.update(data)
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=2)
        return True
    except Exception as e:
        print(f"[Warning] Could not save daemon config: {e}")
        return False


def show_native_folder_picker():
    """
    Displays a native folder picker dialog on the desktop.
    Prioritizes Tkinter with topmost window, with PowerShell FolderBrowserDialog fallback.
    Returns the absolute path selected, or None if cancelled.
    """
    selected_path = None
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        root.lift()
        root.focus_force()

        config = get_stored_config()
        initial_dir = config.get("active_courses_folder")
        if not initial_dir or not os.path.exists(initial_dir):
            initial_dir = str(Path.home())

        chosen = filedialog.askdirectory(
            parent=root,
            title="Select UoPeople Active Courses Directory",
            initialdir=initial_dir
        )
        root.destroy()

        if chosen and os.path.isdir(chosen):
            selected_path = os.path.abspath(chosen)
    except Exception as e:
        print(f"[Warning] Tkinter folder picker failed ({e}), trying PowerShell...")
        try:
            ps_script = (
                "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; "
                "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
                "$f.Description = 'Select UoPeople Active Courses Directory'; "
                "$f.ShowNewFolderButton = $true; "
                "if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"
            )
            proc = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                capture_output=True,
                text=True,
                timeout=60
            )
            out = proc.stdout.strip()
            if out and os.path.isdir(out):
                selected_path = os.path.abspath(out)
        except Exception as pe:
            print(f"[Error] PowerShell folder picker also failed: {pe}")

    if selected_path:
        save_stored_config({"active_courses_folder": selected_path})
        print(f"[Config] Updated active courses directory: {selected_path}")
    return selected_path


def run_course_processor_async(folder_arg="", zip_arg="", course_name=""):
    """Runs process_active_courses.py in a background thread."""
    def _worker():
        try:
            time.sleep(0.5)
            cmd = [sys.executable, str(PROCESSOR_SCRIPT)]
            if folder_arg:
                cmd.extend(["--folder", folder_arg])
            if zip_arg:
                cmd.extend(["--zip", zip_arg])

            print(f"[Daemon] Spawning unpacker: {' '.join(cmd)}")
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            print(f"[Daemon Unpacker Finished] exit_code={proc.returncode}")
            if proc.stdout:
                print(f"[Daemon Unpacker Output]:\n{proc.stdout[:2000]}")
            if proc.stderr:
                print(f"[Daemon Unpacker Stderr]:\n{proc.stderr[:1000]}")
        except Exception as e:
            print(f"[Daemon] Failed to run processor worker: {e}")

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


class CourseExporterHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        path = self.path.split('?')[0].rstrip('/')
        if path in ('', '/health', '/status'):
            self._json_response({
                "status": "ok",
                "service": "uopeople-course-exporter-daemon",
                "port": self.server.server_port,
                "processor": str(PROCESSOR_SCRIPT)
            })
        elif path == '/get-folder':
            config = get_stored_config()
            folder = config.get("active_courses_folder")
            self._json_response({
                "status": "ok",
                "folder": folder if folder and os.path.exists(folder) else None
            })
        elif path == '/select-folder':
            # Support GET for direct browser or popup invocation
            selected = show_native_folder_picker()
            if selected:
                self._json_response({"status": "ok", "folder": selected})
            else:
                self._json_response({"status": "cancelled", "folder": None})
        else:
            self._json_response({"error": "Endpoint not found"}, status=404)

    def do_POST(self):
        path = self.path.split('?')[0].rstrip('/')
        content_len = int(self.headers.get('Content-Length', 0))
        body = b""
        if content_len > 0:
            body = self.rfile.read(content_len)

        data = {}
        if body:
            try:
                data = json.loads(body.decode('utf-8', errors='replace'))
            except Exception:
                pass

        if path == '/select-folder':
            selected = show_native_folder_picker()
            if selected:
                self._json_response({"status": "ok", "folder": selected})
            else:
                self._json_response({"status": "cancelled", "folder": None})

        elif path == '/process-courses':
            file_name = data.get("fileName") or data.get("file_name") or ""
            course_name = data.get("courseName") or data.get("course_name") or ""
            active_folder = data.get("activeCoursesFolder") or data.get("active_courses_folder") or ""

            if active_folder and os.path.exists(active_folder):
                save_stored_config({"active_courses_folder": active_folder})

            print(f"[Daemon] Received process-courses trigger: file='{file_name}', course='{course_name}', folder='{active_folder}'")
            run_course_processor_async(folder_arg=active_folder, zip_arg=file_name, course_name=course_name)

            self._json_response({
                "status": "triggered",
                "message": "Background unpacker initiated",
                "fileName": file_name,
                "courseName": course_name
            })
        else:
            self._json_response({"error": "Endpoint not found"}, status=404)

    def log_message(self, format, *args):
        # Keep daemon logs clean
        sys.stderr.write(f"[Daemon HTTP] {self.address_string()} - {format % args}\n")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="UoPeople Course Exporter Helper Daemon")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Port to bind (default {DEFAULT_PORT})")
    parser.add_argument("--host", default="127.0.0.1", help="Host address (default 127.0.0.1)")
    args = parser.parse_args()

    port = int(os.environ.get("COURSE_EXPORTER_PORT", args.port))
    host = args.host

    server_address = (host, port)
    try:
        httpd = ThreadingHTTPServer(server_address, CourseExporterHandler)
    except OSError as e:
        print(f"[Error] Could not bind daemon to {host}:{port}: {e}")
        sys.exit(1)

    print(f"============================================================")
    print(f"  UoPeople Course Exporter Companion Daemon running")
    print(f"  Endpoint: http://{host}:{port}/")
    print(f"  Routes:")
    print(f"    - GET  /health          Check daemon health")
    print(f"    - GET  /get-folder      Retrieve configured active folder")
    print(f"    - POST /select-folder   Open native desktop folder dialog")
    print(f"    - POST /process-courses Trigger automatic unpacker")
    print(f"============================================================")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Daemon] Shutting down gracefully...")
        httpd.server_close()


if __name__ == "__main__":
    main()
