import os

with open("app/dashboard/page.js", "r", encoding="utf-8") as f:
    content = f.read()

with open("patch_top_opp.txt", "r", encoding="utf-8") as f:
    patch = f.read()

target = "{/* Row 4: Recent Customers */}"
if target in content:
    content = content.replace(target, patch + "\n\n              " + target)
    with open("app/dashboard/page.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched successfully.")
else:
    print("Target not found.")
