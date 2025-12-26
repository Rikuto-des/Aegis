# Aegis Backend

This directory contains the Python-based AI defense engine for Aegis.

## Features

- **Nightshade-style adversarial noise**: Adds subtle noise that confuses AI training
- **i2i destruction patterns**: Interferes with image-to-image AI models
- **Metadata injection**: Embeds anti-AI directives in EXIF and LSB

## Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

```bash
# Full processing with defense level 2 (Shield)
python aegis_engine.py --input image.jpg --output protected.jpg --level 2

# Stealth mode (metadata only)
python aegis_engine.py --input image.jpg --output protected.jpg --level 1

# Maximum protection (Nightshade + i2i destruction)
python aegis_engine.py --input image.jpg --output protected.jpg --level 3

# Specific processing modes
python aegis_engine.py --input image.jpg --output protected.jpg --mode nightshade
python aegis_engine.py --input image.jpg --output protected.jpg --mode i2i
python aegis_engine.py --input image.jpg --output protected.jpg --mode metadata
```

## Defense Levels

1. **Stealth**: Metadata and LSB injection only (no visual changes)
2. **Shield**: Light adversarial perturbations + metadata
3. **Nightshade**: Heavy poisoning + i2i destruction + metadata

## Note

This is a prototype implementation. For production use, you would need:
- More sophisticated adversarial attack algorithms
- Proper EXIF metadata handling
- Enhanced LSB steganography
- GPU optimization for faster processing
