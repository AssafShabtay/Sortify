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
_device = "cuda" if torch.cuda.is_available() else "cpu"


if len(sys.argv) < 3:
    print("Error: Please provide the input folder path and the output JSON path.")
    print("Usage: python Organize_Folder.py <path_to_folder_to_scan> <path_to_output.json>")
    sys.exit(1) # Exit if not enough arguments
folder_path = sys.argv[1] # Use the first argument for input
output_json_path = sys.argv[2]
# Set console output encoding to UTF-8
if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

#-------------------Texts--------------------------------------------------
def extract_pdf_text(file_path):
    start_time = time.time()
    try:
        # Attempt to open the PDF file
        doc = pymupdf.open(file_path)
        text_extracted = ""

        # Loop through all pages
        for page_num in range(len(doc)):
            try:
                page = doc.load_page(page_num)
                text = page.get_text("text")
                text_extracted += text

                # If we have enough text, stop
                if len(text_extracted) >= 1200:
                    return text_extracted
            except Exception as e:
                print(f"Error extracting text from page {page_num}: {e}")
                continue
        return text_extracted

    except Exception as e:
        return None


def extract_docx_text(file_path):
    doc = docx.Document(file_path)
    text = ""
    start_time = time.time()
    # Extract text from paragraphs first
    for para in doc.paragraphs:
        text += para.text + "\n"
        if len(text) >= 1200:
            break

    # If the text is still under 500 characters, add text from tables
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

        # Add table text to the final output, ensuring total length is ≤ 500
        text += table_text

    return text


def extract_txt_text(file_path):
    start_time = time.time()
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            content = file.read()
        return content[:1200]
    except UnicodeDecodeError:
        print(f"Error decoding file {file_path}. Trying with a different encoding.")
        with open(file_path, "r", encoding="latin1") as file:
            content = file.read()
        return content[:1200]


def extract_doc_text(file_path):
    start_time = time.time()
    text = textract.process(file_path).decode("utf-8")
    return text



def extract_tex_text(file_path):
    start_time = time.time()
    with open(file_path, "r", encoding="utf-8") as file:

        return file.read()[:1200]

def extract_epub_text(file_path):
    book = epub.read_epub(file_path)
    text = []
    char_count = 0
    start_time = time.time()
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



## Global configs for maximum speed
#os.environ["TOKENIZERS_PARALLELISM"] = "false"  # Avoid deadlocks
#if torch.cuda.is_available():
#    torch.backends.cudnn.benchmark = True
#    torch.backends.cudnn.deterministic = False
#    torch.backends.cuda.matmul.allow_tf32 = True  # Allow TF32 on Ampere GPUs
#    torch.backends.cudnn.allow_tf32 = True
#
## Use lightweight model
#MODEL_NAME = "nlpconnect/vit-gpt2-image-captioning"
#
## Initialize global variables
#device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
#tokenizer = None
#feature_extractor = None
#model = None
#is_initialized = False
#
#def init_model():
#    """Initialize and optimize the model only once"""
#    global tokenizer, feature_extractor, model, is_initialized
#
#    if is_initialized:
#        return
#
#    print("Loading model...")
#    # Load fastest versions of tokenizer and feature_extractor
#    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
#    feature_extractor = ViTFeatureExtractor.from_pretrained(MODEL_NAME)
#
#    # Load and optimize model
#    model = VisionEncoderDecoderModel.from_pretrained(MODEL_NAME)
#    model.to(device)
#    model.eval()
#
#    # Apply aggressive speedups
#    if device.type == "cuda":
#        model = model.half()  # Use FP16 precision
#
#    # Quantize the model (this reduces model size and improves speed)
#    model = torch.quantization.quantize_dynamic(
#        model, {torch.nn.Linear}, dtype=torch.qint8
#    )
#
#    # Disable all gradients
#    for param in model.parameters():
#        param.requires_grad = False
#
#    # JIT/compile optimizations for newer PyTorch
#    if hasattr(torch, 'compile'):
#        try:
#            model = torch.compile(model, mode="reduce-overhead", fullgraph=True)
#        except Exception as e:
#            print(f"Torch compile error: {e}")
#
#    is_initialized = True
#    print("Model ready")
#
#def preprocess_image(image_path, target_size=(224, 224)):
#    """Preprocess image with maximum efficiency"""
#    # Handle both filepath and PIL image
#    if isinstance(image_path, (str, pathlib.PosixPath)):
#        image_path = str(image_path)  # Convert to string if it's a PosixPath
#        image = Image.open(image_path).convert('RGB')
#    else:
#        image = image_path
#
#    if image.size != target_size:
#        image = image.resize(target_size, Image.BILINEAR)
#
#    # Fast feature extraction
#    inputs = feature_extractor(images=image, return_tensors="pt")
#
#    # Create attention mask (1 for real tokens, 0 for padding)
#    attention_mask = inputs['pixel_values'].new_ones(inputs['pixel_values'].shape[:2])
#
#    # Move to device and optimize precision
#    if device.type == "cuda":
#        inputs = {k: v.to(device).half() for k, v in inputs.items()}
#        attention_mask = attention_mask.to(device).half()  # Ensure it matches the device
#    else:
#        inputs = {k: v.to(device) for k, v in inputs.items()}
#        attention_mask = attention_mask.to(device)
#
#    # Add the attention mask to the inputs
#    inputs['attention_mask'] = attention_mask
#
#    return inputs
#
#def generate_caption(inputs):
#    """Generate caption with minimal settings for speed"""
#    # Ensure no_grad context for inference
#    with torch.no_grad(), torch.cuda.amp.autocast() if device.type == "cuda" else nullcontext():
#        output_ids = model.generate(
#            inputs["pixel_values"],         # Minimal length for speed
#            num_beams=1,             # Greedy search (fastest)
#            do_sample=False,
#            early_stopping=True,
#            use_cache=True,
#            return_dict_in_generate=False,
#            output_scores=False
#        )
#
#    # Fast decoding
#    caption = tokenizer.decode(output_ids[0], skip_special_tokens=True)
#    return caption
#
#def caption_image(image_path):
#    """Main function to caption an image with timing"""
#    # Make sure model is initialized
#    if not is_initialized:
#        init_model()
#
#    # Time the actual processing
#    start_time = time.time()
#
#    # Process pipeline
#    start_time2 = time.time()
#
#    inputs = preprocess_image(image_path)
#    print(f"Preprocessing Time: {time.time() - start_time2:.4f} seconds")
#    start_time1 = time.time()
#    caption = generate_caption(inputs)
#    print(f"Generation Time: {time.time() - start_time1:.4f} seconds")
#
#    # Calculate timing
#    inference_time = time.time() - start_time
#    return caption, inference_time
#
## Nullcontext for PyTorch compatibility
#class nullcontext:
#    def __enter__(self): return None
#    def __exit__(self, *args): pass


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
        #elif extension == ".rtf":
        #    text = extractions.extract_rtf_text(Path(file_path))
        elif extension == ".doc":
            text = extract_doc_text(Path(file_path))
        elif extension == ".tex":
            text = extract_tex_text(Path(file_path))
        elif extension == ".epub":
            text = extract_epub_text(Path(file_path))
#        elif extension in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp", ".ico", ".heif", ".heic", ".avif", ".eps", ".dds", ".dis", ".im", ".mpo", ".msp", ".pxc", ".pfm", ".ppm", ".tga", ".spider", ".sgi", ".xbm", "psd"):
#            text = extractions.caption_image(Path(file_path))
#            print(f"Image caption: {text}")
#            return text
        #elif extension == ".svg":
        #    out = BytesIO()
        #    cairosvg.svg2png(url=Path(file_path), write_to=out)
        #    ext = extractions.caption_image(out)
        else:
            print(f"Unsupported extension: {extension}")


        if text:
            translated_text = translator.translate(text[:500])
            print(f"Translated text (first 200 chars): {translated_text[:200]} \n translated length is {len(translated_text)}")

            if translated_text:
                return translated_text
                summary = summarize_text(translated_text)
                #print(summary)
                return summary
            else:
                print(f"Translation failed for: {file_path}")
                return None
        else:
            counts+=1
            print(f"No text extracted from: {file_path}")
            return None

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None
    finally:
        print(f"Processing time for {file_path}: {time.time() - start_time} seconds")


def process_directory(folder_path,max_workers=4):
    summaries = []
    print(f"Processing folder: {folder_path}")

    # Get all files in the directory
    file_paths = []
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            file_path = os.path.join(root, file)
            if os.path.isfile(file_path):
                file_paths.append(file_path)

    # Process files in parallel
    with concurrent.futures.ThreadPoolExecutor() as executor:
        # Map the extract_file_summary function to all files
        future_to_file = {executor.submit(extract_file_summary, file_path): file_path for file_path in file_paths}

        # Collect results as they complete
        for future in concurrent.futures.as_completed(future_to_file):
            file_path = future_to_file[future]
            try:
                summary_temp = future.result()
                if summary_temp:
                    print(f"Got summary for {file_path}")
                    summaries.append(summary_temp[:500])
            except Exception as e:
                print(f"Error processing {file_path}: {e}")

    if not summaries:
        return "No summaries were generated for this folder."

    # Combine file summaries into a single text
    combined_summary = " | ".join(filter(None, summaries))
    print(f"Combined summary: {combined_summary[:200]}...")

    return combined_summary
    

def run_model_organizer(folder_path, dict_as_one=False, max_workers=4):
    file_summaries = {}
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    start_time = time.time()

    # Process top-level files
    file_paths = []
    top_level_dir_paths = []
    if dict_as_one:
        with os.scandir(folder_path) as entries:
          for entry in entries:
              entry_path = entry.path

              # Skip large files
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


    # Process files
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

    # Process directories
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
    

file_summaries = run_model_organizer(folder_path)

dataset = pd.DataFrame(
      [(path, data) for path, data in file_summaries.items()],
      columns=['path', 'texts']
)
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
if len(X)<5:
    sys.stderr.write("Not enough files")
    sys.exit(1)

    

num_components = min(len(X) - 3, 15)
umap_model = umap.UMAP(n_components=num_components, random_state=42)
X_reduced = umap_model.fit_transform(X)
umap_model = umap.UMAP(n_components=2, random_state=42)
X_reduced_plt = umap_model.fit_transform(X)

np.random.seed(42)

# Ensure data is float64
X_reduced = X_reduced.astype(np.float64)

def objective(trial):
    n_samples = X_reduced.shape[0]
    
    min_samples = trial.suggest_int("min_samples", 2 , 100 if n_samples >= 50 else n_samples - 1)
    min_cluster_size = trial.suggest_int("min_cluster_size", 2,  min(n_samples - 1, 15))
    alpha = trial.suggest_float("alpha", 0.5, 1.5)
    epsilon = trial.suggest_float("cluster_selection_epsilon", 0.5, 1.0)
    metric = trial.suggest_categorical("metric", ["euclidean", "manhattan", "l2"])  # Restricted to valid metrics
    p = trial.suggest_float("p", 1.0, 3.0)

    # Fit HDBSCAN
    clusterer = hdbscan.HDBSCAN(
        min_samples=min_samples,
        min_cluster_size=min_cluster_size,
        alpha=alpha,
        cluster_selection_epsilon=epsilon,
        metric=metric,
        p=p,
        cluster_selection_method="eom",
        prediction_data=True,
        allow_single_cluster=True
    )

    labels = clusterer.fit_predict(X_reduced)

    # Skip cases with all noise (-1 labels)
    if len(set(labels)) <= 1:
        return -1  

    # Compute DBCV score
    return validity_index(X_reduced, labels)

sampler = optuna.samplers.NSGAIISampler(seed=42)  # Use NSGAII for multi-objective tuning
study = optuna.create_study(direction="maximize", sampler=sampler)
study.optimize(objective, n_trials=400)  # Increase trials for better results

# Extract trial numbers and scores
trials = [t.number for t in study.trials]
scores = [t.value for t in study.trials]

# Plot DBCV Score Evolution
#plt.figure(figsize=(10, 5))
#plt.plot(trials, scores, marker='o', linestyle='-')
#plt.xlabel("Trial Number")
#plt.ylabel("DBCV Score")
#plt.title("DBCV Score Optimization Over Trials")
#plt.grid(True)
#plt.show()

# Print best parameters
print(f"Best DBCV Score: {study.best_value}")
print(f"Best Parameters: {study.best_params}")

best_params = study.best_params

# Fit the HDBSCAN model with the best parameters
best_clusterer = hdbscan.HDBSCAN(
    min_samples=best_params["min_samples"],
    min_cluster_size=best_params["min_cluster_size"],
    alpha=best_params["alpha"],
    cluster_selection_epsilon=best_params["cluster_selection_epsilon"],
    metric=best_params["metric"],
    p=best_params["p"],
    cluster_selection_method="eom",
    prediction_data=True,
    allow_single_cluster=True
)

# Get labels using the best parameters
labels = best_clusterer.fit_predict(X_reduced)

# Print the labels corresponding to the best parameters

df = pd.DataFrame(X_reduced_plt, columns=['x', 'y'])
df['label'] = labels
#plt.figure(figsize=(10, 8))
#sns.scatterplot(data=df, x='x', y='y', hue='label', palette='Set1', s=100, legend='full', alpha=1)
#count = 0
#for i in range(len(df)):
#  if df['label'][i] == -1:
#    count += 1
#    plt.text(df['x'][i], df['y'][i], df['label'][i], fontsize=12, alpha=0.7)
#
#plt.title(f'HDBSCAN Clustering Results (Dataset Size: {len(X)})')
#plt.xlabel('UMAP Component 1')
#plt.ylabel('UMAP Component 2')
#plt.legend(title='Cluster Labels', bbox_to_anchor=(1.05, 1), loc='upper left')
#plt.show()
#print(count)


import json

# Make sure this matches what Rust expects
cluster_mapping = [
    {"path": path, "label": int(label)} 
    for path, label in zip(dataset['path'], labels)
]
print("the 2 end")

with open(output_json_path, "w", encoding="utf-8") as f:
    json.dump(cluster_mapping, f, ensure_ascii=False, indent=2)

print("the end")
sys.exit(0)