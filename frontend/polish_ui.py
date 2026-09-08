import os
import re

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements for signup and login
    reps = [
        (r'box-shadow: 0 24px 64px rgba\(0,0,0,0\.4\);', 'box-shadow: var(--shadow-lg);'),
        (r'box-shadow: 0 4px 12px rgba\(0,0,0,0\.1\)', 'box-shadow: var(--shadow-sm)'),
        (r'background: rgba\(248, 250, 252, 0\.1\);', 'background: var(--progress-line);'),
        (r'border: 1px solid rgba\(248, 250, 252, 0\.12\);', 'border: 1px solid var(--line);'),
        (r'background: rgba\(30, 33, 40, 0\.6\);', 'background: var(--panel);'),
        (r'border: 1px solid rgba\(255, 255, 255, 0\.08\);', 'border: 1px solid var(--line);'),
        (r'background: rgba\(255, 255, 255, 0\.05\);', 'background: var(--panel2);'),
        (r'background: rgba\(255, 255, 255, 0\.1\);', 'background: var(--panel2);'),
    ]

    for old, new in reps:
        content = re.sub(old, new, content)

    # Add transitions to important elements
    if 'transition: all 0.3s ease;' not in content:
        content = re.sub(r'(\.signup-page \{|\.signup-container \{|\.login-page \{|\.login-container \{)', r'\1\n          transition: all 0.3s ease;', content)
        content = re.sub(r'(\.signup-input \{|\.login-input \{)', r'\1\n          transition: all 0.3s ease;', content)

    # Give theme button a class instead of inline styles
    content = re.sub(r'style=\{\{[^\}]*position: \'absolute\', top: \'24px\', right: \'24px\',[^\}]*\}\}', 'className="theme-toggle-btn"', content)

    # Inject the .theme-toggle-btn CSS
    if '.theme-toggle-btn {' not in content:
        btn_css = """
        .theme-toggle-btn {
          position: absolute;
          top: 24px;
          right: 24px;
          background: var(--panel2);
          border: 1px solid var(--line);
          color: var(--ivory);
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 24px;
          font-weight: bold;
          font-family: var(--font-heading);
          box-shadow: var(--shadow-sm);
          transition: all 0.3s ease;
          z-index: 100;
        }
        .theme-toggle-btn:hover {
          background: var(--line);
          transform: translateY(-2px);
        }
"""
        content = content.replace('      <style jsx>{`', '      <style jsx>{`' + btn_css)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def update_globals():
    filepath = r"C:\Users\Saubhagyam\ai-sales-agent\frontend\app\globals.css"
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '--shadow-lg:' not in content:
        content = content.replace(':root {', """:root {
  --shadow-lg: 0 24px 64px rgba(0,0,0,0.4);
  --shadow-sm: 0 4px 12px rgba(0,0,0,0.1);
  --btn-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
  --progress-line: rgba(248, 250, 252, 0.1);""")
        content = content.replace('body.light-theme {', """body.light-theme {
  --shadow-lg: 0 24px 64px rgba(0,0,0,0.08);
  --shadow-sm: 0 4px 12px rgba(0,0,0,0.05);
  --btn-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  --progress-line: rgba(0, 0, 0, 0.1);""")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

if __name__ == "__main__":
    update_file(r"C:\Users\Saubhagyam\ai-sales-agent\frontend\app\signup\page.js")
    update_file(r"C:\Users\Saubhagyam\ai-sales-agent\frontend\app\dashboard\login\page.js")
    update_globals()
    print("UI Polish Completed")
