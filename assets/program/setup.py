# setup.py
from distutils.core import setup
import py2exe
setup(
    console=['program.py'],
    options={
        'py2exe': {
            'packages': ['socketio','tkinter','_thread','base64','json'],
            'dist_dir': 'dist',
            'compressed': True,
        }
    })
