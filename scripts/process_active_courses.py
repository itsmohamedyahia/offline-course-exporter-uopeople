#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process Active Courses Script
Unzips downloaded UoPeople course packages in the active courses folder,
removes ZIPs, and creates coursework subfolders (Discussion Forum, Assignment Activity)
for Units 1 through 8. Includes desktop prompt fallback, agy AI agent escalation,
and PushPopFlow task/inbox notifications.
"""

import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import os
import re
import json
import time
import shutil
import zipfile
import subprocess
from pathlib import Path

DEFAULT_ACTIVE_FOLDER = r"S:\01_ACADEMIC_STUDY\UoPeople as Student\01_ACTIVE_COURSES"
DEFAULT_COMPLETED_FOLDER = r"S:\01_ACADEMIC_STUDY\UoPeople as Student\02_COMPLETED_COURSES"
CONFIG_FILE = Path.home() / ".uopeople_course_exporter_config.json"
PUSHPOPFLOW_API = os.environ.get("TASK_MANAGER_API", "http://127.0.0.1:4049")
PUSHPOPFLOW_KEY = os.environ.get("TASK_MANAGER_API_KEY", "a74516de-369e-4405-bac9-3d78a069e7d9")


def get_configured_active_folder():
    """Retrieve active courses folder from config file or return default."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                folder = data.get("active_courses_folder")
                if folder and os.path.exists(folder):
                    return os.path.abspath(folder)
        except Exception as e:
            print(f"[Warning] Could not read config file: {e}")
    return os.path.abspath(DEFAULT_ACTIVE_FOLDER)


def save_configured_active_folder(folder_path):
    """Save active courses folder to config file."""
    try:
        data = {}
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                data = {}
        data["active_courses_folder"] = folder_path
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[Warning] Could not save config file: {e}")


def prompt_user_for_active_folder():
    """Display a native desktop dialog to let user select the active courses folder."""
    print("[UI] Prompting user to select active courses directory...")
    selected_path = None
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox

        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)

        messagebox.showwarning(
            "Active Courses Folder Not Found",
            f"The active courses directory could not be located at:\n{DEFAULT_ACTIVE_FOLDER}\n\n"
            "Please select the active courses directory on your disk."
        )

        selected = filedialog.askdirectory(
            title="Select UoPeople Active Courses Directory",
            initialdir=r"S:\01_ACADEMIC_STUDY" if os.path.exists(r"S:\01_ACADEMIC_STUDY") else Path.home()
        )
        root.destroy()

        if selected and os.path.isdir(selected):
            selected_path = os.path.abspath(selected)
    except Exception as e:
        print(f"[Warning] Tkinter prompt failed ({e}). Trying PowerShell folder browser...")
        try:
            ps_script = """
            Add-Type -AssemblyName System.Windows.Forms
            $f = New-Object System.Windows.Forms.FolderBrowserDialog
            $f.Description = "Select UoPeople Active Courses Directory"
            if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $f.SelectedPath
            }
            """
            proc = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
            out = proc.stdout.strip()
            if out and os.path.isdir(out):
                selected_path = os.path.abspath(out)
        except Exception as pe:
            print(f"[Error] PowerShell prompt also failed: {pe}")

    if selected_path:
        save_configured_active_folder(selected_path)
        return selected_path
    return None


def clean_course_folder_name(zip_stem, active_folder=""):
    """
    Generate clean course folder name matching UoPeople convention.
    E.g.
      UoPeople_Homepage_-_CS_2301-01_Operating_Systems_1_-_AY2026-T5_Markdown_Offline -> CS2301-Operating_Systems_1
      UoPeople_CS_3303-01_Data_Structures_AY2026-T5_Offline -> CS3303-Data_Structures
      UoPeople_PHIL_1402-01_Introduction_to_Philosophy_-_AY2026-T5_Offline -> PHIL1402-Introduction_to_Philosophy
    """
    name = zip_stem
    # Remove prefix UoPeople_
    name = re.sub(r'^UoPeople_', '', name, flags=re.IGNORECASE)
    # Remove known LMS page prefixes
    name = re.sub(r'^(?:Homepage|Course_Home|Home|Table_of_Contents)_*-_*', '', name, flags=re.IGNORECASE)
    # Remove suffix _Offline, _Complete, _Markdown, _StudyGuide, etc.
    name = re.sub(r'_(?:Offline|Complete|Markdown|StudyGuide).*$', '', name, flags=re.IGNORECASE)

    # Extract Course code like CS_2301-01 or CS2301
    m = re.search(r'([A-Z]{2,6})_?(\d{3,5})(?:-\d+)?_*(.*)', name, re.IGNORECASE)
    if m:
        dept = m.group(1).upper()
        num = m.group(2)
        course_code = f"{dept}{num}"
        rest = m.group(3)
        # Strip term tokens like _AY2026-T5, _Term5, etc.
        rest = re.sub(r'_(?:AY\d{4}-T\d|Term\d|20\d\d).*$', '', rest, flags=re.IGNORECASE)
        # Strip all leading and trailing hyphens and underscores
        rest = re.sub(r'^[-_]+|[-_]+$', '', rest)
        rest = re.sub(r'_+', '_', rest).strip('_-')

        # Check if an existing directory in active_folder matches this course_code
        if active_folder and os.path.isdir(active_folder):
            for existing in os.listdir(active_folder):
                if existing.upper().startswith(course_code) and os.path.isdir(os.path.join(active_folder, existing)):
                    return existing

        if rest:
            return f"{course_code}-{rest}"
        return course_code

    clean = re.sub(r'[^a-zA-Z0-9_-]+', '_', name)
    clean = re.sub(r'^[-_]+|[-_]+$', '', clean).strip('_-')
    return clean or "Course_Export"


def find_course_zips(active_folder, target_zip_name=None):
    """Find top-level ZIP packages in active folder and standard Downloads folder."""
    zips = []

    # Check for in-flight .crdownload files first and wait if needed
    downloads_dir = Path.home() / "Downloads"
    for check_dir in [active_folder, str(downloads_dir)]:
        if os.path.isdir(check_dir):
            for f in os.listdir(check_dir):
                if f.lower().endswith('.crdownload') and ('uopeople' in f.lower() or (target_zip_name and target_zip_name.lower() in f.lower())):
                    print(f"[Wait] Detected active browser download ({f}). Waiting up to 15s for completion...")
                    for _ in range(15):
                        time.sleep(1)
                        if not os.path.exists(os.path.join(check_dir, f)):
                            print("[Wait] Download finished.")
                            break

    # 1. Directly in active_folder (top-level only)
    if os.path.isdir(active_folder):
        for f in os.listdir(active_folder):
            full_p = os.path.join(active_folder, f)
            if os.path.isfile(full_p) and f.lower().endswith('.zip'):
                if target_zip_name and f.lower() == target_zip_name.lower():
                    zips.append(full_p)
                elif 'uopeople' in f.lower() or 'offline' in f.lower() or 'course' in f.lower():
                    zips.append(full_p)

    # 2. Check user Downloads folder
    if downloads_dir.exists():
        for f in downloads_dir.iterdir():
            if f.is_file() and f.name.lower().endswith('.zip'):
                is_match = False
                if target_zip_name and f.name.lower() == target_zip_name.lower():
                    is_match = True
                elif f.name.lower().startswith('uopeople_'):
                    is_match = True

                if is_match:
                    target_dest = os.path.join(active_folder, f.name)
                    try:
                        print(f"[Move] Moving {f.name} from Downloads to active folder...")
                        shutil.move(str(f), target_dest)
                        zips.append(target_dest)
                    except Exception as e:
                        print(f"[Warning] Could not move {f.name}: {e}")
                        zips.append(str(f))

    return list(set(zips))


def find_assignment_template(active_folder):
    """Find template assignment.docx in active folder or standard paths."""
    candidates = [
        os.path.join(active_folder, "template assignment.docx"),
        os.path.join(os.path.dirname(active_folder), "04_TEMPLATES_AND_TOOLS", "Document_Templates", "template_apa_doc.docx"),
        os.path.join(os.path.dirname(active_folder), "04_TEMPLATES_AND_TOOLS", "template assignment.docx"),
        os.path.join(os.path.dirname(active_folder), "template assignment.docx"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def extract_units_from_index_html(index_html_content):
    """
    Extracts structured units JSON array from index.html using bracket balancing.
    """
    if not index_html_content:
        return []
    start_tag = 'const units = '
    start = index_html_content.find(start_tag)
    if start == -1:
        return []

    sub_start = start + len(start_tag)
    depth = 0
    in_string = False
    escape = False
    end_idx = -1
    for i in range(sub_start, min(sub_start + 2000000, len(index_html_content))):
        ch = index_html_content[i]
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    end_idx = i + 1
                    break

    if end_idx != -1:
        try:
            json_str = index_html_content[sub_start:end_idx]
            units_data = json.loads(json_str)
            if isinstance(units_data, list):
                return units_data
        except Exception as e:
            print(f"[Warning] Failed to parse units JSON from index.html: {e}")
    return []


def inspect_unit_assignments(unit_num, unit_dir, units_from_html=None, master_md_content=""):
    """
    Determines required assignments for a unit (Unit 1 through 8).
    Returns dict: {'has_discussion': bool, 'has_assignment': bool}
    """
    has_discussion = False
    has_assignment = False

    # 1. Primary: check markdown files in unit directory
    disc_file = os.path.join(unit_dir, "03_Discussions.md")
    if os.path.isfile(disc_file):
        try:
            with open(disc_file, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read().strip()
                if len(content) > 30 and "No discussion forum assigned" not in content:
                    has_discussion = True
        except Exception:
            pass

    assign_file = os.path.join(unit_dir, "04_Assignments.md")
    if os.path.isfile(assign_file):
        try:
            with open(assign_file, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read().strip()
                if len(content) > 30 and "No written assignment assigned" not in content:
                    has_assignment = True
        except Exception:
            pass

    # 2. Structured JSON from index.html
    if units_from_html and (not has_discussion or not has_assignment):
        matched_unit = None
        for idx, u in enumerate(units_from_html):
            u_title = u.get("title", "")
            m_num = re.search(r'(?:unit|week)\s*([1-8])(?!\d)', u_title, re.I)
            u_n = int(m_num.group(1)) if m_num else None
            if u_n == unit_num:
                matched_unit = u
                break

        if not matched_unit and 0 <= unit_num < len(units_from_html):
            cand = units_from_html[unit_num]
            if f"unit {unit_num}" in cand.get("title", "").lower() or f"week {unit_num}" in cand.get("title", "").lower():
                matched_unit = cand

        if matched_unit:
            discs = matched_unit.get("discussions", [])
            assigns = matched_unit.get("assignments", [])
            if not has_discussion and discs and len(discs) > 0:
                has_discussion = True
            if not has_assignment and assigns and len(assigns) > 0:
                has_assignment = True

    # 3. Check Master_Course_Complete.md
    if master_md_content and (not has_discussion or not has_assignment):
        u_pattern = re.compile(rf'#\s*(?:Unit|Week)\s*{unit_num}(?!\d)[\s\S]*?(?=#\s*(?:Unit|Week)\s*{unit_num+1}(?!\d)|\Z)', re.I)
        m_sec = u_pattern.search(master_md_content)
        if m_sec:
            sec_text = m_sec.group(0)
            if not has_discussion and ("## 💬 Discussion Forum" in sec_text or "## Discussion Forum" in sec_text):
                has_discussion = True
            if not has_assignment and ("## 📝 Assignment Activities" in sec_text or "## Assignment Activities" in sec_text or "## 📝 Assignment Activity" in sec_text):
                has_assignment = True

    return {
        "has_discussion": has_discussion,
        "has_assignment": has_assignment
    }


def get_course_unit_dirs(course_dir):
    """
    Locates unit folders (Units 1 to 8) with disambiguation against week folders.
    Returns sorted list of tuples: (unit_num, full_unit_path).
    """
    if not os.path.isdir(course_dir):
        return []
    raw_dirs = []
    for item in os.listdir(course_dir):
        full_p = os.path.join(course_dir, item)
        if os.path.isdir(full_p):
            m = re.search(r'(?:unit|week)\s*([1-8])(?!\d)', item, re.IGNORECASE)
            if m:
                unit_num = int(m.group(1))
                has_md = any(f.endswith('.md') for f in os.listdir(full_p))
                is_prefixed_unit = bool(re.search(r'^\d+_.*unit', item, re.I))
                score = (2 if is_prefixed_unit else 0) + (1 if has_md else 0)
                raw_dirs.append((unit_num, score, full_p))

    unit_map = {}
    for unit_num, score, full_p in raw_dirs:
        if unit_num not in unit_map or score > unit_map[unit_num][0]:
            unit_map[unit_num] = (score, full_p)

    return [(num, unit_map[num][1]) for num in sorted(unit_map.keys()) if 1 <= num <= 8]


def process_course_folder(course_dir, active_folder):
    """
    Processes course directory:
    Finds units 1 through 8, creates coursework folder,
    and subfolders for required assignments (Discussion_Forum, Assignment_Activity).
    """
    print(f"\n[Processing] Analyzing course directory: {os.path.basename(course_dir)}")
    template_docx = find_assignment_template(active_folder)
    if template_docx:
        print(f"[Template] Found template assignment: {template_docx}")

    index_html_content = ""
    index_path = os.path.join(course_dir, "index.html")
    if os.path.isfile(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8', errors='replace') as f:
                index_html_content = f.read()
        except Exception:
            pass

    master_md_content = ""
    master_path = os.path.join(course_dir, "Master_Course_Complete.md")
    if os.path.isfile(master_path):
        try:
            with open(master_path, 'r', encoding='utf-8', errors='replace') as f:
                master_md_content = f.read()
        except Exception:
            pass

    units_from_html = extract_units_from_index_html(index_html_content)

    # Locate unit folders (Units 1 to 8) using unified disambiguation
    unit_dirs = get_course_unit_dirs(course_dir)

    # If no folders on disk, fallback to generating from units_from_html
    if not unit_dirs and units_from_html:
        print("[Fallback] No unit folders on disk. Generating unit folders from index.html...")
        for idx, u in enumerate(units_from_html):
            title = u.get("title", f"Unit {idx+1}")
            clean_u_title = re.sub(r'[\/:*?"<>|]', '_', title)
            clean_u_title = re.sub(r'_+', '_', clean_u_title).replace('  ', ' ').strip(' ._')
            if len(clean_u_title) > 60:
                clean_u_title = clean_u_title[:60].strip(' ._')
            u_folder_name = f"{str(idx+1).zfill(2)}_{clean_u_title}"
            u_dir_path = os.path.join(course_dir, u_folder_name)
            os.makedirs(u_dir_path, exist_ok=True)
            m_num = re.search(r'(?:unit|week)\s*([1-8])(?!\d)', title, re.I)
            unit_num = int(m_num.group(1)) if m_num else (idx + 1)
            if 1 <= unit_num <= 8:
                unit_dirs.append((unit_num, u_dir_path))

    if not unit_dirs:
        print(f"[Warning] No unit folders (1-8) found directly in {course_dir}.")
        return False

    print(f"[Units] Located {len(unit_dirs)} unit folder(s): {[os.path.basename(d) for _, d in unit_dirs]}")

    for unit_num, u_dir in unit_dirs:
        unit_title = os.path.basename(u_dir)
        coursework_dir = os.path.join(u_dir, "coursework")
        os.makedirs(coursework_dir, exist_ok=True)

        reqs = inspect_unit_assignments(unit_num, u_dir, units_from_html, master_md_content)
        has_disc = reqs["has_discussion"]
        has_assign = reqs["has_assignment"]

        print(f"  Unit {unit_num} ({unit_title}): Discussion={has_disc}, Assignment={has_assign}")

        # 1. Discussion Forum Subfolder
        if has_disc:
            disc_dir = os.path.join(coursework_dir, "Discussion_Forum")
            os.makedirs(disc_dir, exist_ok=True)
            disc_file = os.path.join(disc_dir, "discussion.docx")
            if template_docx and not os.path.exists(disc_file):
                try:
                    shutil.copy2(template_docx, disc_file)
                except Exception as e:
                    print(f"    [Warning] Could not copy template to discussion: {e}")

        # 2. Assignment Activity Subfolder
        if has_assign:
            assign_dir = os.path.join(coursework_dir, "Assignment_Activity")
            os.makedirs(assign_dir, exist_ok=True)
            assign_file = os.path.join(assign_dir, "assignment.docx")
            if template_docx and not os.path.exists(assign_file):
                try:
                    shutil.copy2(template_docx, assign_file)
                except Exception as e:
                    print(f"    [Warning] Could not copy template to assignment: {e}")

        if not has_disc and not has_assign:
            print(f"    (No required assignments flagged for Unit {unit_num})")

    return True


def unzip_and_process_course(zip_path, active_folder):
    """Unzips course package into active folder and organizes coursework."""
    zip_stem = Path(zip_path).stem
    clean_name = clean_course_folder_name(zip_stem, active_folder)
    dest_dir = os.path.join(active_folder, clean_name)
    os.makedirs(dest_dir, exist_ok=True)

    print(f"\n[Unzip] Extracting '{os.path.basename(zip_path)}' -> '{dest_dir}'...")

    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            for member in z.infolist():
                try:
                    filename = member.filename.encode('cp437').decode('utf-8')
                except Exception:
                    filename = member.filename

                target_path = os.path.abspath(os.path.join(dest_dir, filename))
                if not target_path.startswith(os.path.abspath(dest_dir)):
                    continue

                if member.is_dir():
                    os.makedirs(target_path, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    with z.open(member) as source, open(target_path, "wb") as target:
                        shutil.copyfileobj(source, target)

        print("[Unzip] Extraction successful.")
    except Exception as e:
        print(f"[Error] Unzip failed: {e}")
        raise e

    # Organize coursework
    success = process_course_folder(dest_dir, active_folder)

    # Delete zip on verified success
    if success:
        try:
            print(f"[Cleanup] Deleting zip archive: {os.path.basename(zip_path)}")
            os.remove(zip_path)
            print("[Cleanup] Done.")
        except Exception as e:
            print(f"[Warning] Could not remove zip file: {e}")

    return dest_dir


def escalate_to_ai_agent(error_msg, context_path):
    """Escalate unhandled issue to local AI agent (agy)."""
    print(f"\n[Escalation] Calling AI Agent 'agy' to resolve issue...")
    prompt = (
        f"The UoPeople course unpacker encountered an issue: {error_msg}\n"
        f"Target directory / path: {context_path}\n"
        f"Please inspect the directory, finish extracting any archives, and ensure coursework folders "
        f"(Discussion_Forum, Assignment_Activity) are properly created inside each unit (Units 1 to 8)."
    )

    try:
        cmd = ["agy", "--dangerously-skip-permissions", "-p", prompt]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180, shell=True)
        print(f"[agy output]:\n{proc.stdout}")
        if proc.returncode == 0:
            print("[agy] AI Agent resolved the issue successfully.")
            return True
        else:
            print(f"[agy] AI Agent exited with code {proc.returncode}: {proc.stderr}")
    except Exception as e:
        print(f"[agy] Could not launch AI agent: {e}")
    return False


def escalate_to_pushpopflow_task(title, context_notes, instructions=""):
    """Create a fallback task in PushPopFlow when agentic resolution is not possible."""
    print(f"\n[PushPopFlow] Escalating: Creating task in PushPopFlow...")
    import uuid
    task_id = f"TASK-{uuid.uuid4().hex[:5].upper()}"
    payload = {
        "id": task_id,
        "title": title,
        "context": context_notes,
        "instructions": instructions or "Inspect coursework structure and resolve manually."
    }
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{PUSHPOPFLOW_API}/tasks",
            data=json.dumps(payload).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {PUSHPOPFLOW_KEY}"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 201):
                print(f"[PushPopFlow] Task {task_id} created successfully in PushPopFlow.")
                return True
    except Exception as e:
        print(f"[PushPopFlow] Failed to create task: {e}")
    return False


def notify_pushpopflow_inbox(title, message, options=None, task_id=None):
    """Send question / notification to PushPopFlow Agent Inbox requesting user opinion."""
    print(f"\n[PushPopFlow Inbox] Sending notification to Agent Inbox...")
    payload = {
        "title": title,
        "message": message,
        "agentName": "agy",
        "taskId": task_id,
        "options": options or ["Acknowledge"]
    }
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{PUSHPOPFLOW_API}/inbox",
            data=json.dumps(payload).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {PUSHPOPFLOW_KEY}"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 201):
                print("[PushPopFlow Inbox] Notification delivered to user's Agent Inbox.")
                return True
    except Exception as e:
        print(f"[PushPopFlow Inbox] Failed to send notification: {e}")
    return False


def archive_completed_courses(active_folder, completed_folder=DEFAULT_COMPLETED_FOLDER):
    """Move completed course directories from active folder to completed folder."""
    if not os.path.isdir(active_folder):
        return
    os.makedirs(completed_folder, exist_ok=True)
    for item in os.listdir(active_folder):
        full_p = os.path.join(active_folder, item)
        if os.path.isdir(full_p) and not item.startswith('.'):
            dest = os.path.join(completed_folder, item)
            print(f"[Archive] Moving completed course '{item}' -> '{dest}'...")
            try:
                shutil.move(full_p, dest)
            except Exception as e:
                print(f"[Warning] Could not archive {item}: {e}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Process and unpack UoPeople course exports.")
    parser.add_argument("--folder", help="Active courses folder override")
    parser.add_argument("--zip", help="Specific ZIP archive filename or path to unpack")
    parser.add_argument("--daemon", action="store_true", help="Run in continuous watcher mode")
    parser.add_argument("--course-dir", help="Process an already extracted course directory directly")
    parser.add_argument("--archive-completed", action="store_true", help="Archive completed courses to 02_COMPLETED_COURSES")
    args = parser.parse_args()

    # Determine active folder
    active_folder = args.folder or get_configured_active_folder()

    if not os.path.exists(active_folder):
        print(f"[Warning] Active courses folder not found: {active_folder}")
        prompted_folder = prompt_user_for_active_folder()
        if prompted_folder and os.path.exists(prompted_folder):
            active_folder = prompted_folder
        else:
            err_msg = f"Active courses folder could not be found or selected: {active_folder}"
            print(f"[Error] {err_msg}")
            if not escalate_to_ai_agent(err_msg, active_folder):
                escalate_to_pushpopflow_task("[Course Unpack Error] Active courses directory not found", err_msg)
                notify_pushpopflow_inbox("Active Courses Directory Relocated", "Could not find active courses folder. Please select or verify folder location in Settings.")
            sys.exit(1)

    print(f"[Active Courses Folder] {active_folder}")

    if args.archive_completed:
        archive_completed_courses(active_folder)
        return

    # Process specific directory if requested
    if args.course_dir:
        target = os.path.abspath(args.course_dir)
        if os.path.isdir(target):
            process_course_folder(target, active_folder)
            return

    # Find ZIP archives
    zips = find_course_zips(active_folder, target_zip_name=args.zip)
    if not zips:
        print("[Status] No pending course ZIP archives found in active courses folder or Downloads.")
        # Check existing course directories that might miss coursework folders
        for item in os.listdir(active_folder):
            full_p = os.path.join(active_folder, item)
            if os.path.isdir(full_p) and not item.startswith('.'):
                unit_dirs = get_course_unit_dirs(full_p)
                if unit_dirs:
                    needs_cw = any(not os.path.exists(os.path.join(u_dir, "coursework")) for _, u_dir in unit_dirs)
                    if needs_cw:
                        print(f"[Re-check] Course directory {item} needs coursework structuring.")
                        process_course_folder(full_p, active_folder)
        return

    print(f"[Discovered] Found {len(zips)} course package(s) to process:")
    for z in zips:
        print(f"  - {os.path.basename(z)}")

    for z in zips:
        try:
            unzip_and_process_course(z, active_folder)
        except Exception as e:
            err_str = str(e)
            print(f"[Error] Processing failed for {z}: {err_str}")
            resolved = escalate_to_ai_agent(err_str, z)
            if not resolved:
                escalate_to_pushpopflow_task(
                    f"[Course Unpack Failed] {os.path.basename(z)}",
                    f"Extraction or coursework structuring failed:\n{err_str}",
                    "Please extract ZIP manually and verify coursework folders."
                )
                notify_pushpopflow_inbox(
                    f"Course Unpack Failed: {os.path.basename(z)}",
                    f"Extraction encountered an error: {err_str}. A manual task has been created.",
                    options=["Open Folder", "Dismiss"]
                )


if __name__ == "__main__":
    main()
