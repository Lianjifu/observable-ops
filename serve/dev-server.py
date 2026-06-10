#!/usr/bin/env python3
"""
Observable Ops Dev Server — Docsify development mode.
Serves from project root; docsify loads markdown from docs/.
Automatically appends .md extension to clean URLs.
"""
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

class GitBookHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        """Override to support clean URLs (no .md extension)."""
        # Remove trailing slash
        path = path.strip('/')
        
        # If it's a directory request, look for index
        if not path or path.endswith('/'):
            path = path + 'index.html'
            return os.path.join(os.getcwd(), path)
        
        # Try original path first
        original = os.path.join(os.getcwd(), path)
        if os.path.exists(original):
            return original
        
        # Try with .md extension (for Docsify clean URLs)
        md_path = path + '.md'
        if os.path.exists(md_path):
            return md_path
        
        # Try as directory with index
        dir_path = os.path.join(os.getcwd(), path, 'index.html')
        if os.path.exists(os.path.join(os.getcwd(), path, 'index.html')):
            return dir_path
        
        # Fall back to original (will 404)
        return original
    
    def end_headers(self):
        """Add CORS headers for cross-origin requests."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    port = 4003
    server = HTTPServer(('0.0.0.0', port), GitBookHandler)
    print(f'Observable Ops dev server: http://0.0.0.0:{port}/')
    server.serve_forever()
