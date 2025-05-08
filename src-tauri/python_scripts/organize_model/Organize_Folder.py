import torch
from pathlib import Path
import time
from deep_translator import GoogleTranslator
import umap
import hdbscan
import pandas as pd
import concurrent.futures
import os
from sentence_transformers import SentenceTransformer
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import re
import optuna
import numpy as np
from hdbscan.validity import validity_index
import pymupdf
import docx
from bs4 import BeautifulSoup as bs
import epub
import textract
import sys
import codecs
import json
import random
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration
from io import BytesIO
import cairosvg

# Set all random seeds for deterministic behavior
np.random.seed(42)
random.seed(42)
torch.manual_seed(42)
torch.cuda.manual_seed_all(42)
os.environ['PYTHONHASHSEED'] = '42'
# Force deterministic behavior in PyTorch
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False


folder_path = sys.argv[1]
output_json_path = sys.argv[2]
toplevel_folders_as_one = sys.argv[3]

treat_toplevel_folders_as_one = True if toplevel_folders_as_one == "true" else False

# make the prints be in utf-8
if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

#-------------------Texts--------------------------------------------------
def extract_pdf_text(file_path):
    try:
        doc = pymupdf.open(file_path)
        text_extracted = ""

        for page_num in range(len(doc)):
            try:
                page = doc.load_page(page_num)
                text = page.get_text("text")
                text_extracted += text

                if len(text_extracted) >= 1200:
                    return text_extracted
            except Exception as e:
                print(f"Error extracting text from page {page_num}: {e}")
                continue
        return text_extracted

    except Exception:
        return None

def extract_doc_text(file_path):
    text = textract.process(file_path).decode("utf-8")
    return text

def extract_docx_text(file_path):
    doc = docx.Document(file_path)
    text = ""
 
    for para in doc.paragraphs:
        text += para.text + "\n"
        if len(text) >= 1200:
            break


    if len(text) < 1200:
        table_text = ""
        for table in doc.tables:
            for row in table.rows:
                row_data = [cell.text.strip() for cell in row.cells]
                table_text += " | ".join(row_data) + "\n"
                if len(text + table_text) >= 1200:
                    break
            if len(text + table_text) >= 1200:
                break


        text += table_text

    return text


def extract_txt_text(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            content = file.read()
        return content[:1200]
    except UnicodeDecodeError:
        print(f"Error decoding file {file_path}. Trying with a different encoding.")
        with open(file_path, "r", encoding="latin1") as file:
            content = file.read()
        return content[:1200]



def extract_tex_text(file_path):
    with open(file_path, "r", encoding="utf-8") as file:

        return file.read()[:1200]

def extract_epub_text(file_path):
    book = epub.read_epub(file_path)
    text = []
    char_count = 0
    for item in book.get_items():
        if item.get_type() == epub.EpubItem.TEXT:
            soup = bs(item.get_body_content(), 'html.parser')
            extracted_text = soup.get_text()
            text.append(extracted_text)
            char_count += len(extracted_text)
            if char_count >= 1200:
                break

    return "".join(text)[:1200]

#-------------------Images--------------------------------------------------

_model = None
_processor = None
_device = None

def load_model(model_name="Salesforce/blip-image-captioning-base", device=None):
    global _model, _processor, _device
    if _model is not None:
        return
    
    _device = device if device else ("cuda" if torch.cuda.is_available() else "cpu")
    torch.set_grad_enabled(False)
    if _device == "cuda":
        torch.backends.cudnn.benchmark = True
    
    _processor = BlipProcessor.from_pretrained(model_name)
    _model = BlipForConditionalGeneration.from_pretrained(model_name).to(_device)
    _model.eval()

def caption_image(image_input, model_name="Salesforce/blip-image-captioning-base", device=None):
    global _model, _processor, _device
    
    if _model is None:
        load_model(model_name, device)
    
    try:
        if isinstance(image_input, Image.Image):
            pil_image = image_input
        elif isinstance(image_input, BytesIO):
            image_input.seek(0)
            pil_image = Image.open(image_input)
        else:
            pil_image = Image.open(image_input)
        start_time = time.time()
        pil_image = pil_image.convert('RGB').resize((224, 224), Image.BILINEAR)
        inputs = _processor(images=pil_image, return_tensors="pt").to(_device)
        
        with torch.inference_mode():
            outputs = _model.generate(
                **inputs,
                max_length=30,
                num_beams=2,
                min_length=5,
                do_sample=True,
                top_p=0.9,
                length_penalty=1.0
            )
            
            caption = _processor.decode(outputs[0], skip_special_tokens=True)
        print(f"imamge procesing {start_time - time.time():.2f}")
        return caption
        
    except Exception as e:
        return None

nltk.download('stopwords')
nltk.download('wordnet')


translator = GoogleTranslator(source='auto', target='en')
model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")


def extract_file_summary(file_path):
    print(f"Processing file: {file_path}")
    start_time =time.time()
    extension = os.path.splitext(file_path)[-1].lower()
    try:
        if extension == ".pdf":
            text = extract_pdf_text(Path(file_path))
        elif extension == ".docx":
            text = extract_docx_text(Path(file_path))
        elif extension == ".txt":
            text = extract_txt_text(Path(file_path))
        elif extension == ".doc":
            text = extract_doc_text(Path(file_path))
        elif extension == ".tex":
            text = extract_tex_text(Path(file_path))
        elif extension == ".epub":
            text = extract_epub_text(Path(file_path))
        elif extension in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp", ".ico", ".heif", ".heic", ".avif", ".eps", ".dds", ".dis", ".im", ".mpo", ".msp", ".pxc", ".pfm", ".ppm", ".tga", ".spider", ".sgi", ".xbm", "psd"):
            text = caption_image(Path(file_path))
            print(f"Image caption: {text}")
            return text
        elif extension == ".svg":
            png_data = BytesIO()
            cairosvg.svg2png(url=str(file_path), write_to=png_data)
            png_data.seek(0)
            pil_image = Image.open(png_data)
            text = caption_image(pil_image)
        else:
            print(f"Unsupported extension: {extension}")


        if text:
            translated_text = translator.translate(text[:500])
            if translated_text:
                return translated_text
            else:
                print(f"Translation failed for: {file_path}")
                return None
        else:
            print(f"No text extracted from: {file_path}")
            return None

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None
    finally:
        print(f"Processing time for {file_path}: {time.time() - start_time:.2f} seconds")


def process_directory(folder_path,max_workers=4):
    summaries = []
    print(f"Processing folder: {folder_path}")
    
    file_paths = []
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            file_path = os.path.join(root, file)
            if os.path.isfile(file_path):
                file_paths.append(file_path)

    with concurrent.futures.ThreadPoolExecutor(max_workers) as executor:
        future_to_file = {executor.submit(extract_file_summary, file_path): file_path for file_path in file_paths}
        for future in concurrent.futures.as_completed(future_to_file):
            file_path = future_to_file[future]
            try:
                summary_temp = future.result()
                if summary_temp:
                    summaries.append(summary_temp[:500])
            except Exception as e:
                print(f"Error processing {file_path}: {e}")

    if not summaries:
        return "No summaries were generated for this folder."
    combined_summary = " | ".join(filter(None, summaries))

    return combined_summary
    

def run_model_organizer(folder_path, dict_as_one, max_workers=4):
    file_summaries = {}
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    start_time = time.time()

    file_paths = []
    top_level_dir_paths = []
    if dict_as_one:
        with os.scandir(folder_path) as entries:
          for entry in entries:
              entry_path = entry.path

              if entry.is_file() and os.path.getsize(entry_path) <= MAX_FILE_SIZE:
                  file_paths.append(entry_path)
              elif entry.is_dir():
                  top_level_dir_paths.append(entry_path)
    else:
      print(f"Processing top-level files in: {folder_path}")
      for root, dirs, files in os.walk(folder_path):
         for file in files:
            file_path = os.path.join(root, file)
            if os.path.isfile(file_path) and os.path.getsize(file_path) <= MAX_FILE_SIZE:
              file_paths.append(file_path)


    print(f"Processing {len(file_paths)} top-level files")
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {executor.submit(extract_file_summary, file_path): file_path for file_path in file_paths}

        for future in concurrent.futures.as_completed(future_to_file):
            file_path = future_to_file[future]
            try:
                summary = future.result()
                if summary:
                    file_summaries[file_path] = summary
            except Exception as e:
                print(f"Error processing top-level file {file_path}: {e}")
                
    if dict_as_one:
      print(f"Processing {len(top_level_dir_paths)} directories")
      with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, max_workers//2)) as executor:
          future_to_dir = {executor.submit(process_directory, dir_path, max_workers=2): dir_path for dir_path in top_level_dir_paths}

          for future in concurrent.futures.as_completed(future_to_dir):
              dir_path = future_to_dir[future]
              try:
                  summary = future.result()
                  file_summaries[dir_path] = summary
              except Exception as e:
                  print(f"Error processing directory {dir_path}: {e}")


    print(f"Total processing time: {time.time() - start_time:.2f} seconds")

    return file_summaries
    

file_summaries = run_model_organizer(folder_path, treat_toplevel_folders_as_one)

dataset = pd.DataFrame(
      [(path, data) for path, data in file_summaries.items()],
      columns=['path', 'texts']
)

dataset['filename'] = dataset['path'].apply(lambda x: os.path.basename(x))
dataset = dataset.sort_values(by='filename').reset_index(drop=True)

stop_words = set(stopwords.words('english'))
lemmatizer = WordNetLemmatizer()

def clean_text(text):
    if not isinstance(text, str):
        return "" 
    text = text.lower()
    text = re.sub(r'[^a-z\s]', '', text, flags=re.A)
    words = text.split()
    cleaned_lemmatized_words = []
    for word in words:
        if word and word not in stop_words: 
            lemmatized_word = lemmatizer.lemmatize(word)
            cleaned_lemmatized_words.append(lemmatized_word)


    return ' '.join(cleaned_lemmatized_words)
dataset['cleaned_texts'] = dataset['texts'].apply(clean_text)

dataset = dataset[dataset['cleaned_texts'].str.len() > 3]
cleaned_texts = dataset['cleaned_texts'].tolist()
X = model.encode(cleaned_texts, convert_to_numpy=True)
if len(X)<6:
    sys.stderr.write("Not enough files")
    sys.exit(1)

num_components = min(len(X) - 3, 15)
umap_model = umap.UMAP(n_components=num_components, random_state=42)
X_reduced = umap_model.fit_transform(X)

X_reduced = X_reduced.astype(np.float64)
n_samples = X_reduced.shape[0]
# Find best parameters
def objective(trial):
    
    
    min_samples = trial.suggest_int("min_samples", 2 , 100 if n_samples >= 50 else n_samples - 1)
    min_cluster_size = trial.suggest_int("min_cluster_size", 2,  min(n_samples - 1, 15))
    alpha = trial.suggest_float("alpha", 0.5, 1.5)
    epsilon = trial.suggest_float("cluster_selection_epsilon", 0.5, 1.0)
    metric = trial.suggest_categorical("metric", ["euclidean", "manhattan", "l2"])  # Restricted to valid metrics
    p = trial.suggest_float("p", 1.0, 3.0)

    clusterer = hdbscan.HDBSCAN(
        min_samples=min_samples,
        min_cluster_size=min_cluster_size,
        alpha=alpha,
        cluster_selection_epsilon=epsilon,
        metric=metric,
        p=p,
        cluster_selection_method="eom",
        prediction_data=True,
        allow_single_cluster=False
    )

    labels = clusterer.fit_predict(X_reduced)
    
    if len(set(labels)) <= 1:
        return -1  

    return validity_index(X_reduced, labels)

sampler = optuna.samplers.NSGAIISampler(seed=42) 
study = optuna.create_study(direction="maximize", sampler=sampler)
study.optimize(objective, n_trials=400)  

trials = [t.number for t in study.trials]
scores = [t.value for t in study.trials]

print(f"Best DBCV Score: {study.best_value}")
print(f"Best Parameters: {study.best_params}")

best_params = study.best_params

best_clusterer = hdbscan.HDBSCAN(
    min_samples=best_params["min_samples"],
    min_cluster_size=best_params["min_cluster_size"],
    alpha=best_params["alpha"],
    cluster_selection_epsilon=best_params["cluster_selection_epsilon"],
    metric=best_params["metric"],
    p=best_params["p"],
    cluster_selection_method="eom",
    prediction_data=True,
    allow_single_cluster=False
)

labels = best_clusterer.fit_predict(X_reduced)

# Writing json
cluster_mapping = [
    {"path": path, "label": int(label)} 
    for path, label in zip(dataset['path'], labels)
]

with open(output_json_path, "w", encoding="utf-8") as f:
    json.dump(cluster_mapping, f, ensure_ascii=False, indent=2)

sys.exit(0)
