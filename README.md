Prate: a fucking reasonable chat system at last
===============================================

**NOT USABLE YET**

I’ve been using text chat systems since 1993, and they are all
basically unusably bad, despite being everybody’s favorite first free
software project and everybody’s favorite startup idea.  Prate is the
first chat system even attempting to satisfy [these basic
requirements][0]:

* Free software.  (Prate is under the GNU GPL v3.)
* Real-time: people normally see your lines within less than a second
  after you send them.
* Peer-to-peer: you don’t have to install or manage software on a server
  to make it work, and it knows how to traverse NATs.
* Replicated: you can look at chat history and add chat lines when
  you’re offline.  When you reconnect to the people you’re talking to,
  all the lines get sent.  This is important not mostly because I’m
  trying to chat while I’m on an airplane but because I don’t want to
  lose messages when my network gets disconnected, and because I switch
  between devices and want to be able to see messages I typed on my
  laptop on my cellphone and vice versa.  (As far as I can tell, the
  POP-not-IMAP nature of XMPP makes this impossible for XMPP chats.)
* Unified-UI: you can chat with many different people or groups of
  people at once using the same app, and see e.g. a list of chat
  channels where you have unread messages.
* Encrypted: your ISP can’t read your chat messages.
* Secure: the people you’re chatting with can’t subvert your chat
  software to e.g. snoop on your other chats.
* Correct: unlike IRC, doesn’t truncate your lines at arbitrary places
  if they get too long.
* File transfers: you can send screenshots and stuff to other people,
  including everybody in a group chat.
* Cross-platform: versions for both GNU/Linux and Android.

[0]: http://lists.canonical.org/pipermail/kragen-tol/2012-November/000968.html

If you agree that these are the most important attributes for a chat
system, you have to use Prate or write something better, because
there’s just fucking nothing else out there.

Okay but how do I use it
------------------------

Prate’s first implementation is as a Chromium (or Chrome) extension.
You can install Prate by going to this URL:

<I don’t yet have an URL for a prebuilt version>

or by pointing Chromium at the directory containing this README file
(<chrome://extensions/>, enable Developer mode if not enabled, click
“Load unpacked extension...”, and point at this directory.)

Fine but what does it do anyway
-------------------------------

When you type a message in a chat channel and hit Enter, the other
people in the channel (now or at any time in the future) can see that
message.  That’s basically it.

Prate replicates the entire past history of your channel onto the
computers of everybody involved.  Any of you can add other people to
the channel.  You stay in a channel even when you’re offline, unlike
IRC or XMPP chats; when you come back online, you see the chat that
happened when you were gone.  If you leave a channel, Prate deletes
your local replica of the channel history, and you can’t re-enter the
channel unless someone still on the channel adds you back.  You can
“mute” a channel, which will

Anyone can start a new channel.

Oh fuck what do I do now
------------------------

1. There are obnoxious people in my channel harassing me and my
   friends.  How do I kick them out?

    Unless they leave when you ask them to, you can’t kick them out.
    Start a new channel and invite your real friends, mute the old
    channel, and use the same name for the new channel.

2. Prate is using too much space on my phone.

    Look at the channel space usage view to see which channels are
    using a lot of space.  Leave some of them.

3. Prate is using too much space on my disk.

    Seriously?

4. Prate is using too much of my time.

    Look on the bright side: at least it’s not Facebook.

5. Prate is insecure and so I’ve been arrested by Sisi’s troops.  They
   are going to kill me because of my political beliefs.

    Yes, Prate is insecure.  In time it might become secure, but it
    isn’t yet.

<http://tonyarcieri.com/whats-wrong-with-webcrypto>
