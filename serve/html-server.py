#!/usr/bin/env python3
"""Serve pre-built HTML files (threaded, crash-resistant)."""
import os
import sys
import errno
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """Per-request thread; daemon threads so the process can exit cleanly."""
    daemon_threads = True
    allow_reuse_address = True


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist'), **kwargs)

    def log_message(self, fmt, *args):
        # Quieter log; keep one line per request
        sys.stderr.write(f"{self.address_string()} - {fmt % args}\n")

    # --- crash resistance: never let a broken client kill the worker ---
    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            # Client went away mid-response; safe to drop.
            self.close_connection = True

    def copyfile(self, source, outputfile):
        """shutil.copyfileobj raises BrokenPipeError if the socket is gone.
        Swallow it so a flaky client can't take down the server."""
        try:
            return super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError) as e:
            if getattr(e, 'errno', None) in (errno.EPIPE, errno.ECONNRESET):
                self.close_connection = True
                return
            raise


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 4003))
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print(f'Observable Ops HTML server: http://10.211.55.13:{port}/  (bound 0.0.0.0:{port})', flush=True)
    print('  threaded, crash-resistant, log -> stderr', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nshutting down...', flush=True)
        server.shutdown()
