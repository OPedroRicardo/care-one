import cv2
from numpy import mean
import csv
from argparse import ArgumentParser
import os

# ! python3 txt_recognition.py --img assets/image1.png --csv assets/image1.csv

# Mapeamento binário dos 7 segmentos para cada dígito
# (topo, superior_direita, inferior_direita, baixo, inferior_esquerda, superior_esquerda, meio)
SEGMENTS_BITMASK = {
    (1, 1, 1, 1, 1, 1, 0): "0",
    (0, 1, 1, 0, 0, 0, 0): "1",
    (1, 1, 0, 1, 1, 0, 1): "2",
    (1, 1, 1, 1, 0, 0, 1): "3",
    (0, 1, 1, 0, 0, 1, 1): "4",
    (1, 0, 1, 1, 0, 1, 1): "5",
    (1, 0, 1, 1, 1, 1, 1): "6",
    (1, 1, 1, 0, 0, 1, 0): "7",
    (1, 1, 1, 1, 1, 1, 1): "8",
    (1, 1, 1, 1, 0, 1, 1): "9",
    (0, 0, 0, 0, 0, 0, 0): ""
}

def setup_args():
    parser = ArgumentParser(description="OCR para Monitores de Pressão Arterial")
    parser.add_argument('--img', required=True, help="Path da imagem a ser lida")
    parser.add_argument('--csv', required=True, help="Path para o CSV de mapeamento")
    parser.add_argument('--debug', action='store_true', help="Ativa visualização das janelas do OpenCV")
    parser.add_argument('--threshold', type=int, default=0, help="Valor manual de threshold (0 para Otsu)")

    return parser.parse_args()

def load_map_config(csv_path):
    """Carrega o mapeamento do CSV e agrupa por título ordenando pelo index."""
    configs = {}
    with open(csv_path, mode='r') as f:
        reader = csv.DictReader(f)

        for row in reader:
            if 'title' not in row:
                raise ValueError("CSV deve conter um cabeçalho com title, index, x, y, w, h.")
            title = row['title']

            if title not in configs:
                configs[title] = []

            configs[title].append({
                'index': int(row['index']),
                'roi': (int(row['x']), int(row['y']), int(row['w']), int(row['h']))
            })

    # Garante que os dígitos de cada grupo estejam na ordem correta (centena -> unidade)
    for title in configs:
        configs[title].sort(key=lambda x: x['index'])
        configs[title] = [item['roi'] for item in configs[title]]
    return configs

def get_digit(roi, thresh_val):
    """Analisa os 7 pontos estratégicos da ROI para identificar o dígito."""

    h, w = roi.shape
    dw = int(w * 0.2) # Delta w (15% da largura)
    dh = int(h * 0.15) # Delta h (15% da altura)
    mid_y = h // 2
    mid_x = w // 2

    segments = [
        (mid_x, dh),          # topo
        (w - dw, h // 4),     # superior direita
        (w - dw, 3 * h // 4), # inferior direita
        (mid_x, h - dh),      # baixo
        (dw, 3 * h // 4),     # inferior esquerda
        (dw, h // 4),         # superior esquerda
        (mid_x, mid_y),       # meio
    ]

    on_segments = []
    for (x, y) in segments:
        region = roi[y-2:y+3, x-2:x+3] # Média de área 5x5
        on_segments.append(int(mean(region) > thresh_val))

    digit = SEGMENTS_BITMASK.get(tuple(on_segments), "?")

    if (digit == "?"):
        print(f"Erro ao calcular segmentos: {on_segments}")
    return digit

def get_thresh(img_path, threshold_arg):
    frame = cv2.imread(img_path)

    if frame is None:
        raise FileNotFoundError(f"Erro: Não foi possível carregar {img_path}")

    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Binarização: Otsu é automático, mas permitimos override via argv
    if threshold_arg <= 0:
        thresh_val, thresh = cv2.threshold(frame, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        thresh_val, thresh = cv2.threshold(frame, threshold_arg, 255, cv2.THRESH_BINARY_INV)

    return thresh_val, thresh, frame

def read_image_text(img_path, configs, args):
    """Pipeline principal de processamento por imagem."""
    thresh_val, thresh, frame = get_thresh(img_path, args.threshold)

    result = {}
    for title, rois in configs.items():
        value = ""

        for (x, y, w, h) in rois:
            roi_img = thresh[y:y+h, x:x+w]
            value += get_digit(roi_img, thresh_val)

            if args.debug:
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 1)

        result[title] = value

    if args.debug:
        cv2.imshow(f"Debug - {img_path}", frame)
        cv2.imshow(f"Thresh - {img_path}", thresh)

    return result

def main():
    args = setup_args()

    try:
        config_map = load_map_config(args.csv)

        img2txt = read_image_text(args.img, config_map, args)

        res_title = f"\n--- Resultados para: {os.path.basename(args.img)} ---"
        print(res_title)
        print(img2txt)
        print("-"*len(res_title))

        if args.debug:
            print("\nPressione qualquer tecla nas janelas de imagem para fechar...")
            cv2.waitKey(0)
            cv2.destroyAllWindows()

    except Exception as e:
        print(f"Erro crítico: {e}")

if __name__ == "__main__":
    main()
