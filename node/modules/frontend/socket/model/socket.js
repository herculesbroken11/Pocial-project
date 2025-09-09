var ObjectId = require('mongodb').ObjectID;

function Socket() {
	/** 
	 * Function to init socket
	 * **/
	this.init = (io, socket) => {
		/**
		 * Function is called when any user login to site
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('login', function (data) {
			var room = findClientsSocket(io, data.id);
			if (room.length < 2) {
				socket.username = data.user;
				socket.room = data.id;
				//socket.avatar = gravatar.url(data.avatar, {s: '140', r: 'x', d: 'mm'});
				socket.authId = data.id;
				// Add the client to the room
				socket.join(data.id);
			}
		});// end login

		/**
		 * Function is called when any user join any room
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('chatlogin', function (data) {
			socket.username = data.user;
			socket.room = data.id;
			socket.userid = data.u_id;
			// Add the client to the room
			socket.join(data.id);
		});// end chatlogin


		/**
		 * Function is called when any user disconnect with socket
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('disconnect', function (data) {
			if (typeof socket.authId !== 'undefined') {
				socket.broadcast.to(socket.authId).emit('logout_initiated', { id: socket.authId });
				socket.leave(socket.authId);
				if (typeof socket.room !== 'undefined') {
					socket.leave(socket.room);
				}
			}
		});// end disconnect

		/**
		 * Function is called when any user disconnect with socket
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('logout', function (data) {
			if (typeof data.id !== 'undefined') {
				socket.broadcast.to(data.id).emit('logout_initiated', { id: data.id });
				socket.leave(data.id);
				if (typeof socket.room !== 'undefined') {
					socket.leave(socket.room);
				}
			}
		});// end disconnect


		/**
		 * Function is called when any sender send new message
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('msg', function (data) {
			socket.broadcast.to(data.receiver_id).emit('update_chat_counter', data);
			socket.broadcast.to(data.conversation_id).emit('message', data);
		});//end msg


		/**
		 * Function is used to update is read in messages of a particular sender
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('mark_message_as_read', function (data) {
			let updateData = {
				modified: getUtcDate(),
				is_read: ACTIVE,
			}

			const collection = db.collection(TABLE_NOTIFICATIONS);
			collection.updateOne({ _id: ObjectId(data.message_id) }, { $set: updateData }, (err) => {
				if (!err) {
					socket.broadcast.to(data.receiver_id).emit('update_chat_counter', data);
				}
			});
		});//end mark_message_as_read

		/**
		 * Function is used to broadcast event of notification read to particular sender
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('mark_notification_as_read', function (data) {
			socket.broadcast.to(data.id).emit('notification_received', data);
		});//end mark_message_as_read

		/**
		 * Function is used to update is read in messages of a particular sender
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('chat_counter', function (data) {
			socket.broadcast.to(data.id).emit('update_chat_counter', data);
		});//end mark_message_as_read


		/**
		 * Function is called when notification is send
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('socketRequest', function (data) {
			socket.broadcast.to(data.room_id).emit('notification_received', data);
		}); // end socketRequest


		/**
		 * Function is called when Sender is typing
		 *
		 * @param data as Data
		 *
		 * @return void.
		 */
		socket.on('show_is_typing', function (data) {
			try {
				socket.broadcast.to(data.chatfriend_id).emit('user_chat_typing', { id: data.roomid, user: data.user, chatfriendid: data.chatfriend_id, img: data.img });
			} catch (e) {
			}
		});// end show_is_typing

	}/* init socket end */

	/**
	 * Function to get connected users list
	 *
	 * @param io        As Socket IO Instance
	 * @param roomId    As Room Id
	 * @param namespace As Namespace
	 *
	 * @return void.
	 */
	function findClientsSocket(io, roomId, namespace) {
		var res = [],
			ns = io.of(namespace || "/");    // the default namespace is "/"
		if (ns) {
			for (var id in ns.connected) {
				if (roomId) {
					var index = ns.connected[id].rooms.indexOf(roomId);
					if (index !== -1) {
						res.push(ns.connected[id]);
					}
				} else {
					res.push(ns.connected[id]);
				}
			}
		}
		return res;
	}// end findClientsSocket()

}
module.exports = new Socket();