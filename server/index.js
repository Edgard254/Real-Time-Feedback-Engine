const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const CodeMirror = require('codemirror');
require('codemirror/mode/javascript/javascript');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const collaborations = {};

io.on('connection', (socket) => {
  socket.on('join collaboration', (collaborationID) => {
    if (!collaborations[collaborationID]) {
      collaborations[collaborationID] = {
        participants: [],
        code: CodeMirror.Doc(''),
        comments: [],
      };
    }
    collaborations[collaborationID].participants.push(socket.id);
    socket.emit('editor content', collaborations[collaborationID].code.getValue());
    socket.emit('comments', collaborations[collaborationID].comments);
    socket.join(collaborationID);
  });

  socket.on('change', (delta, collaborationID) => {
    collaborations[collaborationID].code = CodeMirror.Doc.applyChanges(
      collaborations[collaborationID].code,
      [delta]
    );
    socket.broadcast.to(collaborationID).emit('change', delta);
  });

  socket.on('comment', (comment, collaborationID) => {
    collaborations[collaborationID].comments.push(comment);
    io.to(collaborationID).emit('comment', comment);
  });

  socket.on('disconnect', () => {
    for (const collaborationID in collaborations) {
      const participants = collaborations[collaborationID].participants;
      const participantIndex = participants.indexOf(socket.id);
      if (participantIndex !== -1) {
        participants.splice(participantIndex, 1);
        if (participants.length === 0) {
          delete collaborations[collaborationID];
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});