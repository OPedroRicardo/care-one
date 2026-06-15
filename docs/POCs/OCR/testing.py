CSV_PATH = 'images_test.csv'

test_cases = {}

# img,key,val
with open(CSV_PATH, mode='r') as f:
    reader = csv.DictReader(f)

    for row in reader:
        img = row['img']
        key = row['key']
        val = row['val']

        if img not in test_cases.keys():
            test_cases[img] = []

        test_cases[img].append((key, val))
