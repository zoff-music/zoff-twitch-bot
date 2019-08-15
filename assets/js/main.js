window.addEventListener("load", function() {
  document
    .getElementById("save-data-button")
    .addEventListener("click", submitData);

  document
    .getElementById("delete-data-button")
    .addEventListener("click", deleteData);

  document.getElementById("adminpass").addEventListener("change", function() {
    dirtyFields.adminpass = true;
  });
  document.getElementById("userpass").addEventListener("change", function() {
    dirtyFields.userpass = true;
  });
  document.getElementById("time").addEventListener("change", function() {
    dirtyFields.time = true;
  });
  document.getElementById("zoffchannel").addEventListener("change", function() {
    dirtyFields.zoffchannel = true;
  });
  document.getElementById("moderate").addEventListener("change", function() {
    dirtyFields.moderate = true;
  });
  document
    .getElementById("add-new-command-button")
    .addEventListener("click", addNewCommand);
  newCommandTemplate = createElementFromHTML(
    document.getElementById("new-command-template").innerHTML
  );
  document.getElementById("new-command-template").remove();

  var delete_buttons = document.getElementsByClassName("delete-command-button");
  for (var i = 0; i < delete_buttons.length; i++) {
    addDeleteListener(delete_buttons[i]);
  }
  var save_buttons = document.getElementsByClassName("save-command-button");
  for (var i = 0; i < save_buttons.length; i++) {
    addSaveListener(save_buttons[i]);
  }
});

var currentCounter = 0;
var newCommandTemplate;
var dirtyFields = {
  adminpass: false,
  userpass: false,
  time: false,
  zoffchannel: false,
  moderate: false
};

function createElementFromHTML(htmlString) {
  var div = document.createElement("div");
  div.innerHTML = htmlString.trim();

  // Change this to div.childNodes to support multiple top-level nodes
  return div.firstChild;
}

function addSaveListener(button) {
  var attr = button.getAttribute("data-for-key");
  button.addEventListener("click", function() {
    saveCommand(attr, button);
  });
}

function addDeleteListener(button) {
  var attr = button.getAttribute("data-for-key");
  button.addEventListener("click", function() {
    deleteCommand(attr, button);
  });
}

function saveCommand(key, button) {
  var commandName = key;
  var firstSave = false;
  if (button.getAttribute("data-saved") === "false") {
    firstSave = true;
    commandName = document.getElementById("key-" + key).value;
    commandName.trim();
    if (commandName.length < 2) {
      toast("The command must be longer than 2 characters", false);
      return;
    }
    if (commandName.substring(0, 1) != "!") {
      toast("The command must start with !", false);
      return;
    }
  }
  if (firstSave) {
    sendSaveCommand(
      commandName,
      document.getElementById("value-" + key).value,
      function() {
        updateVariablesForSavedButtons(key, button, commandName);
      }
    );
  } else {
    sendSaveCommand(key, document.getElementById("value-" + key));
  }
}

function sendSaveCommand(key, value, callback, errorCallback) {
  Helper.ajax({
    method: "POST",
    url: "/saveCommand",
    headers: {
      "Content-Type": "application/json"
    },
    data: {
      key: key,
      value: value
    },
    success: function(response) {
      var response = JSON.parse(response);
      if (!response.error) {
        toast("Saved command.", true);
        if (typeof callback === "function") callback();
      } else {
        tosat(
          "Something went wrong when saving, please try again later.",
          false
        );
        if (typeof errorCallback === "function") errorCallback();
      }
    },
    error: function(response) {
      var response = JSON.parse(response);
      toast("Something went wrong when saving, please try again later.", false);
    }
  });
}

function sendDeleteCommand(key, button) {
  Helper.ajax({
    method: "POST",
    url: "/deleteCommand",
    headers: {
      "Content-Type": "application/json"
    },
    data: {
      key: key
    },
    success: function(response) {
      var response = JSON.parse(response);
      if (!response.error) {
        toast("Deleted command.", true);
        removeCommandRow(key, button);
      } else {
        tosat(
          "Something went wrong when deleting, please try again later.",
          false
        );
      }
    },
    error: function(response) {
      var response = JSON.parse(response);
      toast(
        "Something went wrong when deleting, please try again later.",
        false
      );
    }
  });
}

function updateVariablesForSavedButtons(key, button, commandName) {
  var thisContainer = document.getElementsByClassName("container-" + key)[0];
  thisContainer.querySelector("#key-" + key).id = "key-" + commandName;
  thisContainer.querySelector("#value-" + key).id = "value-" + commandName;
  thisContainer
    .querySelector(".delete-command-button")
    .setAttribute("data-for-key", commandName);
  thisContainer
    .querySelector(".save-command-button")
    .setAttribute("data-for-key", commandName);
  thisContainer
    .querySelector(".label-key")
    .setAttribute("for", "key-" + commandName);
  thisContainer
    .querySelector(".label-value")
    .setAttribute("for", "value-" + commandName);
  thisContainer.querySelector(".save-command-button").className +=
    " save-command-key-" + commandName;
  thisContainer
    .querySelector(".save-command-button")
    .setAttribute("data-saved", "true");
  thisContainer
    .querySelector(".delete-command-button")
    .setAttribute("data-saved", "true");
  thisContainer.querySelector(".delete-command-button").className +=
    " delete-command-key-" + commandName;
}

function deleteCommand(key, button) {
  if (button.getAttribute("data-saved") === "false") {
    removeCommandRow(key, button);
    return;
  }
  sendDeleteCommand(key, button);
}

function removeCommandRow(key, button) {
  button.removeEventListener("click", function() {
    deleteCommand(key, button);
  });
  document
    .getElementsByClassName("save-command-key-" + key)[0]
    .removeEventListener("click", function() {
      saveCommand(
        key,
        document.getElementsByClassName("save-command-key-" + key)[0]
      );
    });
  document
    .getElementsByClassName(
      "container-" + button.getAttribute("data-for-key")
    )[0]
    .remove();
}

function addNewCommand() {
  var copy = createElementFromHTML(
    "<div class='row'>" + newCommandTemplate.innerHTML + "</div>"
  );

  copy.querySelector("#key-").id = "key-" + currentCounter;
  copy.querySelector("#value-").id = "value-" + currentCounter;
  copy
    .querySelector(".delete-command-button")
    .setAttribute("data-for-key", currentCounter);
  copy
    .querySelector(".save-command-button")
    .setAttribute("data-for-key", currentCounter);
  copy.querySelector(".label-key").setAttribute("for", "key-" + currentCounter);
  copy
    .querySelector(".label-value")
    .setAttribute("for", "value-" + currentCounter);
  copy.querySelector(".save-command-button").className +=
    " save-command-key-" + currentCounter;
  copy.querySelector(".delete-command-button").className +=
    " delete-command-key-" + currentCounter;
  document
    .getElementsByClassName("command-container")[0]
    .insertAdjacentHTML(
      "beforeend",
      "<div class='row container-" +
        currentCounter +
        "'>" +
        copy.innerHTML +
        "</div>"
    );
  addDeleteListener(
    document.getElementsByClassName("delete-command-key-" + currentCounter)[0]
  );
  addSaveListener(
    document.getElementsByClassName("save-command-key-" + currentCounter)[0]
  );

  currentCounter += 1;
}

function toast(msg, good) {
  M.toast({
    html: msg,
    displayLength: 4000,
    classes: `${good ? "green" : "red"} lighten`
  });
}

function deleteData() {
  Helper.ajax({
    method: "POST",
    url: "/delete",
    headers: {
      "Content-Type": "application/json"
    },
    success: function(response) {
      var response = JSON.parse(response);
      if (!response.error) {
        toast("Deleted channel.", true);
      } else {
        tosat(
          "Something went wrong when deleting, please try again later.",
          false
        );
      }
    },
    error: function(response) {
      var response = JSON.parse(response);
      toast(
        "Something went wrong when deleting, please try again later.",
        false
      );
    }
  });
}

function submitData() {
  var sendObject = {};
  if (dirtyFields.adminpass) {
    sendObject.adminpass = document.getElementById("adminpass").value;
  }
  if (dirtyFields.userpass) {
    sendObject.userpass = document.getElementById("userpass").value;
  }
  if (dirtyFields.zoffchannel) {
    sendObject.zoffchannel = document.getElementById("zoffchannel").value;
  }
  if (dirtyFields.time) {
    sendObject.time = document.getElementById("time").value;
  }
  if (dirtyFields.moderate) {
    sendObject.moderate = document.getElementById("moderate").checked;
  }
  Helper.ajax({
    method: "POST",
    url: "/save",
    headers: {
      "Content-Type": "application/json"
    },
    data: { saveObject: sendObject },
    success: function(response) {
      var response = JSON.parse(response);
      if (!response.error) {
        toast("Saved settings.", true);
      } else {
        toast(
          "Something went wrong when saving, please try again later.",
          false
        );
      }
    },
    error: function(response) {
      var response = JSON.parse(response);
      toast("Something went wrong when saving, please try again later.", false);
    }
  });
}

var Helper = {
  ajax: function(obj) {
    var _async = true;
    if (obj.async) _async = obj.async;
    if (obj.method == undefined && obj.type != undefined) obj.method = obj.type;
    if (obj.method == undefined) obj.method = "GET";
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState == XMLHttpRequest.DONE) {
        // XMLHttpRequest.DONE == 4
        if (
          xmlhttp.status == 200 ||
          xmlhttp.status == 201 ||
          xmlhttp.status == 202
        ) {
          obj.success(xmlhttp.responseText, xmlhttp);
        } else if (obj.hasOwnProperty("error")) {
          obj.error(xmlhttp);
        }
      }
    };

    xmlhttp.open(obj.method, obj.url, _async);
    if (obj.headers) {
      for (header in obj.headers) {
        xmlhttp.setRequestHeader(header, obj.headers[header]);
      }
    }
    if (obj.data) {
      if (typeof obj.data == "object") obj.data = JSON.stringify(obj.data);
      //xmlhttp.send(sendRequest);
      xmlhttp.send(obj.data);
    } else xmlhttp.send();
  }
};
