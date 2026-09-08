import os

file_path = r"c:\Users\Saubhagyam\ai-sales-agent\frontend\app\signup\page.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = {
    "#0F2A28": "#0f172a",
    "#153835": "#1e293b",
    "#1B4441": "#0f172a",
    "#F2A93B": "#0ea5e9",
    "#F3ECD9": "#f8fafc",
    "#C9C2AC": "#94a3b8",
    "rgba(242, 169, 59": "rgba(14, 165, 233",
    "rgba(243, 236, 217": "rgba(248, 250, 252",
    "rgba(201, 194, 172": "rgba(148, 163, 184",
    "%23C9C2AC": "%2394a3b8",
    "color: #0F2A28": "color: #ffffff", # btn-primary text color
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Theme updated successfully.")
