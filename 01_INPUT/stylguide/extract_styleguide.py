import os
import fitz  # PyMuPDF
import sys

def extract_pdf_content(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        
        # Create a directory for this PDF's outputs
        output_dir = os.path.join(os.path.dirname(pdf_path), "extracted", base_name)
        os.makedirs(output_dir, exist_ok=True)
        
        md_content = f"# {base_name}\n\n"
        
        print(f"Processing {base_name}...")
        
        for i, page in enumerate(doc):
            # Extract Text
            text = page.get_text()
            md_content += f"## Page {i+1}\n\n{text}\n\n"
            
            # Render Image
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # 2x zoom for better quality
            img_filename = f"{base_name}_page_{i+1:03d}.png"
            img_path = os.path.join(output_dir, img_filename)
            pix.save(img_path)
            
            md_content += f"![Page {i+1}]({img_filename})\n\n"
            
        # Save Markdown
        md_path = os.path.join(output_dir, "content.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
            
        print(f"Finished {base_name}: {len(doc)} pages processed.")
        
    except Exception as e:
        print(f"Error processing {pdf_path}: {e}")

def main():
    folder_path = os.path.dirname(os.path.abspath(__file__))
    
    # Verify PyMuPDF is installed
    try:
        import fitz
        print(f"PyMuPDF version: {fitz.__version__}")
    except ImportError:
        print("PyMuPDF (fitz) not found. Please install it with: pip install pymupdf")
        sys.exit(1)

    pdf_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.pdf')]
    
    if not pdf_files:
        print("No PDF files found in the current directory.")
        return

    print(f"Found {len(pdf_files)} PDF files.")
    
    for pdf_file in pdf_files:
        extract_pdf_content(os.path.join(folder_path, pdf_file))

if __name__ == "__main__":
    main()
