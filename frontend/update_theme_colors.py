import os
import re

def update_colors(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Define replacements
    replacements = [
        (r'#0f172a', 'var(--bg)'),
        (r'#0f1115', 'var(--bg)'),
        (r'#1e293b', 'var(--panel)'),
        (r'rgba\(30, 33, 40, 0\.6\)', 'var(--panel)'),
        (r'#f8fafc', 'var(--ivory)'),
        (r'#e2e8f0', 'var(--ivory)'),
        (r'#94a3b8', 'var(--muted)'),
        (r'#64748b', 'var(--muted)'),
        (r'#334155', 'var(--line)'),
        (r'#1e293b', 'var(--panel)'),
        (r'#0ea5e9', 'var(--primary)'),
        (r'#0284c7', 'var(--primary-hover)'),
        (r'rgba\(248, 250, 252, 0\.12\)', 'var(--line)'),
        (r'rgba\(255, 255, 255, 0\.08\)', 'var(--panel2)'),
        (r'rgba\(255, 255, 255, 0\.05\)', 'var(--panel2)'),
        (r'rgba\(255, 255, 255, 0\.1\)', 'var(--panel2)'),
    ]

    for old, new in replacements:
        content = re.sub(old, new, content)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    update_colors(r"C:\Users\Saubhagyam\ai-sales-agent\frontend\app\signup\page.js")
    update_colors(r"C:\Users\Saubhagyam\ai-sales-agent\frontend\app\dashboard\login\page.js")
    print("Colors updated successfully")
