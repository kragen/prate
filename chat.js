// Who needs jQuery in 2013? ☺
var D = document;
function $(_) { return D.getElementById(_) }
function add(mom, babe) { mom.appendChild(babe); return mom }

$('chatform').addEventListener('submit', function(ev) {
  ev.preventDefault();
  if ($('chat').value) addChatLine($('name').value, $('chat').value);
  $('chat').value = '';
});

function addChatLine(nick, txt) {
  add($('o'), add(D.createElement('div'), D.createTextNode('<'+nick+'> '+txt)));
  if ($('o').childNodes.length > 32) $('o').removeChild($('o').firstChild);
}

