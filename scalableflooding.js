// <http://lists.canonical.org/pipermail/kragen-hacks/2012-March/000537.html>

/* Scalable flooding information distribution, in JS.

Here are a few information distribution problems:

- Text chat: A group of friends using a text chat room for a period of
  years.  Each wants to see all the lines of chat posted by any of the
  others at any time, even when they were offline.

- Bookmarks synchronization: each of my web browsers on each of my
  computers has a file of bookmarks, and I add and edit bookmarks on
  each of them frequently, including when the browser isn’t connected
  to the Internet.  I want any information I’ve entered on any of the
  machines to be available on all of the others as soon as possible
  --- immediately, if possible.

- Offline email: My mail server is always online (well, basically
  always) but I read and answer email on machines that are physically
  closer to me, and which are often not online.  I want my email to
  get sent as soon as I get back online.

One way to solve these problems is with a central server that controls
the “master” copy of the information being distributed, while other
machines submit proposed changes to it, and it accepts or rejects
them.  This has advantages (the server can check to make sure that
complicated consistency properties are maintained) and disadvantages
(setting up and administering a server is a pain in the ass, it
becomes a target for denial-of-service attacks, and nothing works
while you or the server are offline.)

These problems each ought to be solvable without servers, with the
various computers talking to each other directly over the internet
once they have a chance.  They have a common set of properties that
suggests that a common information distribution layer is desirable:

- Each one consists of a group of nodes, each of which replicates all
  the information of the group; none of the information in the group
  is private from some of the nodes.

- The number of nodes in each group is small, usually less than ten.

- At least some old information continues to be valuable, and the
  total amount of information being managed is small enough that it
  probably isn’t desirable to delete old information.

- The group lasts for potentially many years and millions of separate
  information items, and during that time it may need to recover from
  node failures and network partitions.

- It’s desirable to reduce distribution latency to the minimum.

Various forms of flooding seem like a reasonable approach to solving
this problem.  Flooding’s only problem is that it can’t scale to a
very large number of nodes each of which continues to produce new
traffic, since every doubling in the number of nodes doubles the load
on each node, but that’s not a problem in this case.

This CommonJS module exports a Node class that implements an
efficient form of flooding, and runs a simple regression test on it
during loading (which takes 11ms in Chrome on a low-end netbook).

Platform requirements
---------------------

This code is written in JS.

It works on Node.js (even ancient versions like 0.1.97) and in modern
web browsers.  It depends on the `Array.prototype.forEach` method and
the JSON module, which aren’t standardized and don’t exist in ancient
browsers.  `forEach` can be added with a polyfill, but that can break
other code in your page.  The JSON module can be added with a polyfill
and is very unlikely to break other code.

If loaded in a CommonJS environment, it will export its entry points
with CommonJS.

There’s some turned-off debugging code that expects `require('sys')`
to have methods `.inspect` and `.debug`.

Programming interface
---------------------

The interface between the information distribution logic and the rest
of the application consists of the following:

A Node implements the following public methods:

- `subscribe(newNoteHandler: function(string))`: causes every note
  published to any Node in the group, in the past or the future, to be
  passed to the `newNoteHandler()` function.  This is normally called
  at application startup, potentially resulting in a few million calls
  on `newNoteHandler()` if you have a few million notes.

- `publish(note: string)`: causes `note` to be published to all the
  Nodes in the group as soon as possible, causing each of their
  newNoteHandlers to be invoked.  The Node treats the `note` as an
  opaque blob of Unicode; assigning any further meaning to it belongs
  in other parts of the software.  However, duplicate notes may be
  silently ignored.

- `connect(peer: Channel)`: called to provide the Node with a
  communications channel to some other node in the group.  This
  channel is assumed to be an interface to a network connection that
  already provides connection-layer authentication, authorization,
  privacy, reliability, and integrity guarantees.  An authenticated
  SSL connection, say.

- `pickle()`: returns a string containing the node’s identity and
  state, for purposes of persistence or migration.

See the testDistribution function below for some sample client code
calling these.

The Channel interface, implemented by the SimChannel test-harness
class below, contains three methods for the Node to call:

- `send(message: Serializable)`: causes `message` to be delivered to the
  peer as soon as possible, unless the connection is lost.  The
  message needs to be JSON-serializable, but is otherwise treated as
  opaque.

- `on_receive(receive: function(Serializable))`: causes `receive` to be
  invoked once for each past or future message received from the peer
  over the channel.  It’s invalid to call `on_receive` twice on the
  same Channel.

- `on_close(report_close: function())`: causes report_close() to be
  invoked if the Channel is already closed or closes in the future.
  It's invalid to call `on_close` twice on the same Channel.

To use this code in a real application, you’d need to provide an
object that implements these methods and pass it to .connect().

You can instantiate a Node in two ways:

- `new Node()`: Creates a new Node with a new
  identity.

- `new Node(string)`: given the string returned from the
  `.pickle()` method of a previous, dead incarnation of the node,
  produces a new incarnation of the node.  This doesn’t handle
  reconnecting to other peers.  You have to do that yourself.

TODO
----

If more than one of a node’s neighbors gets a new note at around the
same time, it may end up requesting the same note from all of them.
It probably should wait a bit before making the second and subsequent
requests.

Each origin ought to cryptographically sign each of its notes, thus
avoiding data-corruption attacks.

The newNoteHandler might benefit from knowing the origin of the note.

 */

(function(exports){

// First, some very minimal regression test infrastructure.  (One of
// those things that's one line of code in Python and 60 in JS.)

ok('', '');
ok({}, {});
// Dictionary equality must be insensitive to insertion order!
ok({a: true, b: true}, {b: true, a: true});
ok([], []);

exports.ok = ok;
function ok(a, b) {
    var a_str = JSON.stringify(a);
    var b_str = JSON.stringify(b);
    assert(equal(a, b), a_str+' does not equal '+b_str);
}

exports.assert = assert;
function assert(truthvalue, message) {
    if (truthvalue) return;
    message = message || 'assertion failure';
    if (message.constructor !== String) message = message();
    throw new Error(message);
}

ok(equal(undefined, undefined), true);
ok(equal(null, undefined), false);
ok(equal(undefined, null), false);
ok(equal(undefined, {}), false);
ok(equal({}, {}), true);
ok(equal({x:1}, {}), false);
ok(equal({}, {x:1}), false);
ok(equal({x:1}, {x:1}), true);
ok(equal([1, 2], [2, 1]), false);
ok(equal([2, 1], [2, 1]), true);

exports.equal = equal;
function equal(a, b) {
    if (a === undefined) return b === undefined;
    if (a === null) return b === null;
    if (a.constructor === Object) return dictEqual(a, b);
    // XXX seek out isEqualTo method?
    if (a.constructor === Array) return arrayEqual(a, b);
    return a === b;

    function dictEqual(a, b) {
        if (b.constructor !== Object) return false;
        return (allKeysEqual(a, b) && allKeysEqual(b, a));

        function allKeysEqual(a, b) {
            for (var key in a) {
                if (a.hasOwnProperty(key)) {
                    if (!b.hasOwnProperty(key)) return false;
                    if (!equal(b[key], a[key])) return false;
                }
            }
            return true;
        }
    }

    function arrayEqual(a, b) {
        if (b.constructor !== Array) return false;
        if (b.length !== a.length) return false;
        for (var ii = 0; ii < a.length; ii++) {
            if (!equal(a[ii], b[ii])) return false;
        }
        return true;
    }
}


// Now, a scenario that tests whether the node works properly or not.

exports.runTest = runTest;
function runTest() {
    testDistribution(function(arg) { return new Node(arg) });
}

function testDistribution(nodeFactory) {
    var aa = nodeFactory(), bb = nodeFactory();
    var aaNotes = {};
    aa.subscribe(adderToSet(aaNotes));

    ok(aaNotes, {});

    aa.publish('hi');
    ok(aaNotes, set(['hi']));

    aa.publish('bye');
    ok(aaNotes, set(['hi', 'bye']));

    var bbNotes = {};
    bb.subscribe(adderToSet(bbNotes));
    ok(bbNotes, {});

    // Connect the two nodes and verify that the notes flow across.
    var sim = new Sim();
    var abConn = sim.connectNodes(aa, bb);
    sim.runUntilQuiescent();

    ok(aaNotes, bbNotes);

    // Verify that a new note posted to aa gets received at bb.
    aa.publish('new');
    sim.runUntilQuiescent();
    ok(bbNotes, set(['hi', 'bye', 'new']));

    // And vice versa.
    bb.publish('2');
    sim.runUntilQuiescent();
    ok(aaNotes, set(['2', 'hi', 'bye', 'new']));


    // Connect an additional node.  Verify items flow both ways.
    var cc = nodeFactory();
    cc.publish('3');
    var bcConn = sim.connectNodes(bb, cc);
    sim.runUntilQuiescent();
    assert('3' in aaNotes);
    assert('3' in bbNotes);

    var ccNotes = {};
    //var sys = require('sys');
    //sys.debug(sys.inspect(cc));
    cc.subscribe(adderToSet(ccNotes));
    ok(ccNotes, set(['2', 'hi', 'bye', 'new', '3']));


    // Make the network cyclic; verify that it reaches quiescence.
    var acConn = sim.connectNodes(aa, cc);
    sim.runUntilQuiescent();

    assert(!('5' in aaNotes));
    cc.publish('5');
    sim.runUntilQuiescent();
    assert('5' in bbNotes);
    assert('5' in ccNotes);


    // Break the loop and verify that it still works.
    acConn.close();
    //abConn.startLogging();
    cc.publish('postcut');
    sim.runUntilQuiescent();
    assert('postcut' in aaNotes);

    // But once a node is cut off entirely, it can't communicate.
    bcConn.close();
    cc.publish('postcutc');
    sim.runUntilQuiescent();
    assert('postcutc' in ccNotes);
    assert(!('postcutc' in aaNotes));

    // But the other nodes still can.
    bb.publish('postcutb');
    sim.runUntilQuiescent();
    assert('postcutb' in bbNotes);
    assert('postcutb' in aaNotes);
    assert(!('postcutb' in ccNotes));

    // If we reconnect, then we’ll resynchronize.  Unfortunately,
    // while the main point of this code is that we’ll do so
    // efficiently, i.e. without passing too many messages, this test
    // doesn’t verify the efficiency part.
    bcConn = sim.connectNodes(bb, cc);
    sim.runUntilQuiescent();
    assert('postcutc' in aaNotes);
    assert('postcutb' in ccNotes);

    // Test unpickling a node.
    ccPickle = cc.pickle();
    //require('sys').debug(ccPickle);
    bcConn.close();

    cc = null;
    ccNotes = {};
    cc = nodeFactory(ccPickle);
    cc.subscribe(adderToSet(ccNotes));
    assert('postcutc' in ccNotes);
    assert('postcutb' in ccNotes);
    cc.publish('lazarus');
    assert('lazarus' in ccNotes);
    assert(!('lazarus' in bbNotes));

    // Now reconnect it and ensure things still work.
    bcConn = sim.connectNodes(bb, cc);
    sim.runUntilQuiescent();
    assert('lazarus' in bbNotes);

    cc.publish('cyrus');
    sim.runUntilQuiescent();
    assert('cyrus' in bbNotes);

    aa.publish('welcome');
    sim.runUntilQuiescent();
    assert('welcome' in ccNotes);
}


// Some helpers for the test.
exports.set = set;

function set(items) {
    var rv = {};
    items.forEach(function(item) { rv[item] = true });
    return rv;
}

exports.adderToSet = adderToSet;

function adderToSet(aSet) {
    return function(item) { aSet[item] = true };
}


// The node implementation that supposedly satisfies the test.

exports.Node = Node;

function Node(state) {
    this.peers = [];
    this.newNoteHandlers = [];
    if (state) {
        state = JSON.parse(state);
        this.myId = state.myId;
        this.origins = state.origins;
    } else {
        this.myId = Math.random();
        this.origins = {};      // one Array of notes per origin.
        this.origins[this.myId] = [];
    }
}

// Node implementation of public interface.

Node.prototype.subscribe = function(newNoteHandler) {
    this.newNoteHandlers.push(newNoteHandler);

    for (var origin in this.origins) {
        if (this.origins.hasOwnProperty(origin)) {
            this.origins[origin].forEach(newNoteHandler);
        }
    }
};

Node.prototype.publish = function(newNote) {
    this.gotNote(this.myId, this.origins[this.myId].length, newNote);
};

Node.prototype.connect = function(peer) {
    this.peers.push(peer);
    var self = this;

    peer.onReceive(function(message) { self.handleMessage(peer, message) });
    peer.onClose(function() { removeFromArray(self.peers, peer) });

    for (var originId in this.origins) {
        if (this.origins.hasOwnProperty(originId)) {
            this.reportStatus(peer, originId);
        }
    }
};

// Node Internals.

Node.prototype.handleMessage = function(peer, message) {
    this['handleMsg'+message.type](peer, message.body);
};

Node.prototype.handleMsggot = function(peer, body) {
    var myLastSeqno = (this.origins[body.originId] || []).length - 1;
    for (var seqno = myLastSeqno + 1; seqno <= body.seqno; seqno++) {
        this.send(peer, 'want', {originId: body.originId, seqno: seqno});
    }
};

Node.prototype.handleMsgwant = function(peer, body) {
    var note = this.origins[body.originId][body.seqno];
    assert(note !== undefined);
    this.send(peer, 'note', { originId: body.originId
                            , seqno: body.seqno
                            , note: note
                            });
};

Node.prototype.handleMsgnote = function(peer, body) {
    this.gotNote(body.originId, body.seqno, body.note);
};

Node.prototype.gotNote = function(originId, seqno, note) {
    if (!this.origins[originId]) this.origins[originId] = [];
    var origin = this.origins[originId];

    if (seqno === origin.length) {
        origin.push(note);
        assert(origin[seqno] === note);

        this.newNoteHandlers.forEach(function(newNoteHandler) {
            newNoteHandler(note);
        });

        var self = this;
        this.peers.forEach(function(peer) {
            self.reportStatus(peer, originId);
        });
    }
};

Node.prototype.reportStatus = function(peer, originId) {
    this.send(peer, 'got', { originId: originId
                           , seqno: this.origins[originId].length - 1
                           });
};

Node.prototype.send = function(peer, type, body) {
    peer.send({type: type, body: body});
};

Node.prototype.pickle = function() {
    return JSON.stringify({myId: this.myId, origins: this.origins});
};

// An early version of the Node was 92 lines compared to the
// equivalent Python version’s 63.  I wonder what it would be in
// CoffeeScript.


// The test harness discrete event simulator.  Really just an event queue.

exports.Sim = Sim;
function Sim() {
    this.pendingEvents = [];
}

Sim.prototype.postpone = function(callback) {
    this.pendingEvents.push(callback);
};

Sim.prototype.runNext = function() {
    this.pendingEvents.shift()();
};

Sim.prototype.runUntilQuiescent = function() {
    while (this.pendingEvents.length !== 0) this.runNext();
};

Sim.prototype.connectNodes = function(aa, bb) {
    var connections = socketpair(this);
    aa.connect(connections[0]);
    bb.connect(connections[1]);
    return connections[0];
};

function socketpair(sim) {
    var aa = new SimChannel(sim), bb = new SimChannel(sim);
    aa.beConnectedTo(bb);
    bb.beConnectedTo(aa);
    return [aa, bb];
}

function SimChannel(sim) {
    this.sim = sim;
    this.queue = [];
}

// Implementation of channel interface for SimChannel.

SimChannel.prototype.onReceive = function(receiveHandler) {
    assert(this.receiveHandler === undefined);
    this.receiveHandler = receiveHandler;
    this.queue.forEach(this.receiveHandler);
    delete this.queue;
};

SimChannel.prototype.send = function(message) {
    this.log('sending '+JSON.stringify(message));
    assert(this.otherEnd !== undefined, 'must call beConnectedTo first');

    // Warning: we are depending on the Sim to maintain the order of
    // the messages in flight.
    var self = this;
    this.sim.postpone(function() { self.otherEnd.simulateReceiving(message) });
};

SimChannel.prototype.onClose = function(closeHandler) {
    assert(this.closeHandler === undefined);
    this.closeHandler = closeHandler;
};

// Interface for setup and simulation of SimChannel.

SimChannel.prototype.beConnectedTo = function(otherEnd) {
    this.otherEnd = otherEnd;
};

SimChannel.prototype.close = function() {
    this.log('closing');
    var otherEnd = this.otherEnd;
    delete this.otherEnd;

    if (!otherEnd) return;
    otherEnd.close();

    if (this.closeHandler) this.closeHandler();
};

SimChannel.prototype.startLogging = function() { this.logging = true };

// Internal method of SimChannel.

SimChannel.prototype.simulateReceiving = function(message) {
    this.log('receiving '+JSON.stringify(message));
    if (this.receiveHandler) {
        this.receiveHandler(message);
    } else {
        this.queue.push(message);
    }
};

SimChannel.prototype.log = function(logMessage) {
    if (this.logging) require('sys').debug('SC '+logMessage);
};


// Utility function.

(function() {
    var numbers = [3, 6, 99, 7, 18];
    removeFromArray(numbers, 99);
    ok(numbers, [3, 6, 7, 18]);
})();

function removeFromArray(array, item) {
    var index = array.indexOf(item);
    if (index === -1) return;
    array.splice(index, 1);
};


// Now that all the classes are initialized, invoke the test.

runTest();

// This is how we decide how to do our exporting, either with CommonJS or just
// a plain global scalableflooding object:
})((typeof exports !== 'undefined') ? exports : (this.scalableflooding = {}));

// Local Variables:
// compile-command: "node scalableflooding.js"
// End:
