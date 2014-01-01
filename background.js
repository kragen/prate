// See if we can open a browser tab with the chat in it.

chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({url: "chat.html"});
});