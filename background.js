// See if we can open a browser tab with the chat in it.

chrome.browserAction.onClicked.addListener(tab => {
    chrome.tabs.create({url: "chat.html"});
});