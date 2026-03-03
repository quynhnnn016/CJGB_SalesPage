import os

# Lấy đường dẫn thư mục hiện tại chứa script (tương đối)
# Bất kể ai tải code về, hàm này luôn trả về đúng thư mục chứa file edit_html.py trên máy họ.
current_dir = os.path.dirname(os.path.abspath(__file__))

# Trỏ tới file index.html nằm ở cùng thư mục
file_path = os.path.join(current_dir, "index.html")

if not os.path.exists(file_path):
    print(f"Lỗi: Không tìm thấy file tại '{file_path}'. Hãy đảm bảo script nằm chung thư mục với index.html.")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

header_end = 0
for i, line in enumerate(lines):
    if "</header>" in line:
        header_end = i
        break

footer_start = 0
for i in range(len(lines)-1, -1, -1):
    if '<footer class="py-5">' in lines[i]:
        footer_start = i
        break

new_content = lines[:header_end+1]
new_content.append("""
    <section class="py-5">
      <div class="container-fluid">
        <h2 class="my-5">Menu Đồ Uống Của Khách</h2>
        <!-- Container rỗng sẽ được JS fill dữ liệu vào -->
        <div class="row" id="product-list-container">
            <!-- Dữ liệu load từ n8n sẽ nằm ở đây -->
        </div>
      </div>
    </section>
""")
new_content.extend(lines[footer_start:])

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_content)

print(f"Đã cập nhật thành công {file_path}!")
