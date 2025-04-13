import extractions
import torch
from pathlib import Path
import time
from deep_translator import GoogleTranslator
import umap
import hdbscan
import pandas as pd
import concurrent.futures
import os
from io import BytesIO
import cairosvg
from sentence_transformers import SentenceTransformer
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import re
import optuna
import numpy as np
import matplotlib.pyplot as plt
from hdbscan.validity import validity_index


import seaborn as sns

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
            text = extractions.extract_pdf_text(Path(file_path))
        elif extension == ".docx":
            text = extractions.extract_docx_text(Path(file_path))
        elif extension == ".txt":
            text = extractions.extract_txt_text(Path(file_path))
        elif extension == ".rtf":
            text = extractions.extract_rtf_text(Path(file_path))
        elif extension == ".doc":
            text = extractions.extract_doc_text(Path(file_path))
        elif extension == ".tex":
            text = extractions.extract_tex_text(Path(file_path))
        elif extension == ".epub":
            text = extractions.extract_epub_text(Path(file_path))
        elif extension in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp", ".ico", ".heif", ".heic", ".avif", ".eps", ".dds", ".dis", ".im", ".mpo", ".msp", ".pxc", ".pfm", ".ppm", ".tga", ".spider", ".sgi", ".xbm", "psd"):
            text = extractions.caption_image(Path(file_path))
            print(f"Image caption: {text}")
            return text
        elif extension == ".svg":
            out = BytesIO()
            cairosvg.svg2png(url=Path(file_path), write_to=out)
            ext = extractions.caption_image(out)
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
    print(f"Processing {len(files)} top-level files")
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

file_summaries = run_model_organizer("/content/drive/MyDrive/Dataset")

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
cleaned_texts = dataset['cleaned_texst'].tolist()
X = model.encode(cleaned_texts, convert_to_numpy=True)

umap_model = umap.UMAP(n_components=15, random_state=42)
X_reduced = umap_model.fit_transform(X)
umap_model = umap.UMAP(n_components=2, random_state=42)
X_reduced_plt = umap_model.fit_transform(X)

np.random.seed(42)

# Ensure data is float64
X_reduced = X_reduced.astype(np.float64)

def objective(trial):
    min_samples = trial.suggest_int("min_samples", 2, 100)
    min_cluster_size = trial.suggest_int("min_cluster_size", 2, 15)
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
        prediction_data=True
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
plt.figure(figsize=(10, 5))
plt.plot(trials, scores, marker='o', linestyle='-')
plt.xlabel("Trial Number")
plt.ylabel("DBCV Score")
plt.title("DBCV Score Optimization Over Trials")
plt.grid(True)
plt.show()

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
    prediction_data=True
)

# Get labels using the best parameters
labels = best_clusterer.fit_predict(X_reduced)

# Print the labels corresponding to the best parameters

df = pd.DataFrame(X_reduced_plt, columns=['x', 'y'])
df['label'] = labels
plt.figure(figsize=(10, 8))
sns.scatterplot(data=df, x='x', y='y', hue='label', palette='Set1', s=100, legend='full', alpha=1)
count = 0
for i in range(len(df)):
  if df['label'][i] == -1:
    count += 1
    plt.text(df['x'][i], df['y'][i], df['label'][i], fontsize=12, alpha=0.7)

plt.title(f'HDBSCAN Clustering Results (Dataset Size: {len(X)})')
plt.xlabel('UMAP Component 1')
plt.ylabel('UMAP Component 2')
plt.legend(title='Cluster Labels', bbox_to_anchor=(1.05, 1), loc='upper left')
plt.show()
print(count)


import json

# Make sure this matches what Rust expects
cluster_mapping = [
    {"path": path, "label": int(label)} 
    for path, label in zip(dataset['path'], labels)
]

# Write to JSON
output_json_path = "clustered_paths.json"
with open(output_json_path, "w", encoding="utf-8") as f:
    json.dump(cluster_mapping, f, ensure_ascii=False, indent=2)

print(f"Cluster mapping written to {output_json_path}")
