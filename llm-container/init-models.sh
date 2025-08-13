#!/bin/bash

echo "Initializing Ollama models..."

# Pull models for natural language to SQL conversion
echo "Pulling llama2 model..."
ollama pull llama2

echo "Pulling codellama model for better SQL generation..."
ollama pull codellama

echo "Pulling mistral model as alternative..."
ollama pull mistral

echo "Models initialized successfully!"
echo "Available models:"
ollama list
