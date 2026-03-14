import cv2
import os
from sys import argv

# python3 img_map.py assets/image1.png

# Caminho da imagem a ser mapeada
img_path = argv[1] if len(argv) > 1 else 'assets/image1.png'

if not os.path.exists(img_path):
    print(f"Erro: {img_path} não encontrado.")
    exit()

img = cv2.imread(img_path)
h_orig, w_orig = img.shape[:2]

# Se a imagem for gigante (ex: foto de celular), vamos reduzir para exibir
screen_w = 1280
scale = screen_w / w_orig if w_orig > screen_w else 1.0
display_img = cv2.resize(img, (int(w_orig * scale), int(h_orig * scale)))

rois = []
ix, iy = -1, -1
curr_x, curr_y = -1, -1
drawing = False

def mouse_callback(event, x, y, flags, param):
    global ix, iy, curr_x, curr_y, drawing, rois

    # Converte a coordenada da tela de volta para a coordenada real da imagem
    real_x, real_y = int(x / scale), int(y / scale)

    if event == cv2.EVENT_LBUTTONDOWN:
        drawing = True
        ix, iy = real_x, real_y

    elif event == cv2.EVENT_MOUSEMOVE:
        curr_x, curr_y = real_x, real_y

    elif event == cv2.EVENT_LBUTTONUP:
        drawing = False
        rx, ry, rw, rh = min(ix, real_x), min(iy, real_y), abs(ix - real_x), abs(iy - real_y)
        if rw > 5 and rh > 5:
            rois.append((rx, ry, rw, rh))
            print(f"ROI #{len(rois)}: ({rx}, {ry}, {rw}, {rh})")

# Define a janela como NORMAL para permitir redimensionamento manual sem travar
cv2.namedWindow('Calibrador', cv2.WINDOW_NORMAL)
cv2.setMouseCallback('Calibrador', mouse_callback)

print("--- REGRAS DE MARCAÇÃO ---")
print("* Marque UM DÍGITO por retângulo.")
print("* Ordem: Centena -> Dezena -> Unidade.")
print("* Teclas: [s] Salvar lista | [c] Limpar | [q] Sair")

while True:
    canvas = img.copy()

    for (rx, ry, rw, rh) in rois:
        cv2.rectangle(canvas, (rx, ry), (rx + rw, ry + rh), (255, 0, 0), 3)

    if drawing:
        cv2.rectangle(canvas, (ix, iy), (curr_x, curr_y), (0, 255, 0), 2)

    # Redimensiona apenas para exibição (o cálculo da ROI usa a imagem original)
    view = cv2.resize(canvas, (int(w_orig * scale), int(h_orig * scale)))
    cv2.imshow('Calibrador', view)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('c'):
        rois = []
    elif key == ord('s'):
        print(f"\nsystolic_rois = {rois}\n")

cv2.destroyAllWindows()
