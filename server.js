const express = require('express');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 8080;
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
  app.use(express.json())
  app.set('view engine', 'ejs')
  app.use(cookieParser());
  app.use(
    session({
      key: 'user_id',
      secret: 'coursesChantier',
      resave: false,
      saveUninitialized: false,
      cookie: {
        expires: 60 * 60 * 24,
      },
    })
  );
  const corsOptions = {
    origin: process.env.PORT,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  };
  app.use(cors(corsOptions));
  
  const router = require('./routes/router.js');
  app.use('/', router);

app.listen(port, function(){
    console.log(`Connected on port ${port}`);
});