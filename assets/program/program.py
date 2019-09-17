import socketio
from tkinter import filedialog
from tkinter import *
from tkinter import messagebox
import _thread
import base64
import json

fileName = ""
channelName = ""
password = ""
window = Tk()
sio = socketio.Client()
joinedChannel = False
socketThreadName = "socket-thread"

def join_channel(channel, password):
    print("trying to join", channel, password)
    sio.emit("join_silent", {"channel": channel, "password": str(base64.b64encode(password.encode('utf-8')), 'utf-8')})

@sio.on("join_silent_accepted")
def join_silent_accepted(data):
    print("Join accepted")

@sio.on("join_silent_declined")
def join_silent_declined(data):
    messagebox.showwarning("Error", "Something went wrong, have you checked your password and channelname?")

@sio.on("np")
def new_now_playing(data):
    print(data)
    #np_now = json.loads(data)
    if("np" in data):
        if(len(data["np"]) == 1):
            currentChannel.configure(text="Channel: " + channelName)
            currentPlaying.configure(text="Now playing: " + data["np"][0]["title"])
            f=open(fileName, "w")
            f.write(data["np"][0]["title"])
            f.close()
    #currentSongNowAndChannel.configure(text=channelName + " - " + data["np"]["title"])

@sio.event
def connect():
    print("connected")
    join_channel(channelName, password)

def createSocket():
    global channelName
    global password

    channelName = channelInput.get()
    password = passwordInput.get()

    if channelName == "" or fileName == "":
        messagebox.showwarning("Error", "No channel or file-name selected")
        return

    if not joinedChannel:
        _thread.start_new_thread( joinSocket, (socketThreadName, 2) )
    else:
        join_channel(channelName, password)

def joinSocket(threadName, delay):
    global sio
    global joinedChannel
    print("connecting " + str(joinedChannel))

    if not joinedChannel:
        joinedChannel = True
        sio.connect('http://localhost')
        sio.wait()
    else:
        join_channel(channelName, password)


def createWindow():
    global window
    window.title("Zoff song-writer")
    createTopLabels()
    createInputFields()
    createFileButton()
    createJoinButton()
    window.mainloop()

def createTopLabels():
    global header
    global emptyLabel
    global intro
    global passwordIntro
    global passwordIntro2
    global currentChannel
    global currentPlaying

    header = Label(window, text="Zoff song-writer", font=("Arial Bold", 25))
    emptyLabel = Label(window, text="")
    intro = Label(window, text="To join a channel, type the channel-name in the input field")
    passwordIntro = Label(window, text="If the channel has a password, type it in the password field.")
    passwordIntro2 = Label(window, text="If there is no password, leave the password field empty")
    currentChannel = Label(window, text="")
    currentPlaying = Label(window, text="")

    header.grid(column=0, row=0)
    emptyLabel.grid(column=0, row=1)
    intro.grid(column=0, row=2)
    emptyLabel.grid(column=0, row=3)
    passwordIntro.grid(column=0, row=4)
    passwordIntro2.grid(column=0, row=5)
    emptyLabel.grid(column=0, row=6)
    currentChannel.grid(column=0, row=7)
    currentPlaying.grid(column=0, row=8)
    emptyLabel.grid(column=0, row=9)

def createInputFields():
    global channelLabel
    global passwordLabel
    global emptyLabel

    global channelInput
    global passwordInput

    channelLabel = Label(window, text="Channel")
    passwordLabel = Label(window, text="Password")
    emptyLabel = Label(window, text="")

    channelInput = Entry(window,width=30)
    passwordInput = Entry(window,width=30)

    channelLabel.grid(column=0, row=10)
    channelInput.grid(column=0, row=11)
    passwordLabel.grid(column=0, row=12)
    passwordInput.grid(column=0, row=13)
    emptyLabel.grid(column=0, row=14)

def createJoinButton():
    global joinButton

    joinButton = Button(window, text="Join", command=createSocket)
    joinButton.grid(column=0, row=18)

def createFileButton():
    global fileButton
    global fileNameLabel
    global emptyLabel
    fileButton = Button(window, text="Choose file..", command=fileNameButtonClick)
    fileNameLabel = Label(window, text="No file..")
    emptyLabel = Label(window, text="")

    fileNameLabel.grid(column=0, row=15)
    fileButton.grid(column=0, row=16)
    emptyLabel.grid(column=0, row=17)

def fileNameButtonClick():
    global fileName
    fileName =  filedialog.askopenfilename(title = "Select file",filetypes=(('text files', 'txt'),))
    fileNameLabel.configure(text="File: " + fileName)

createWindow()
#createSocket()
