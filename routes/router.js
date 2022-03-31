const express = require('express');
const router = express.Router();
const db = require('../db-config');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const uuid = require('uuid');

// ==================
// ROUTES DISPONIBLES
// ==================
router.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
  
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);
  
    // Pass to next layer of middleware
    next();
  });
  //..................................................
  // Matériel:  Obtenir - Créer - Modifier - Supprimer
  //..................................................
  router.get('/tools', function getApi(req, res) {
    db.query(`SELECT * FROM utils`, (err, results) => {
      if (err) {
        res.status(500).send('Erreur de traitement de la demande');
        alert(err);
      }
      res.status(200).json(results);
    });
  });
  
  router.post('/tool', function getApi(req, res) {
    const {reference, designation, description}= req.body;
    db.query(`INSERT INTO utils (reference, designation, description) VALUES (?,?,?)`, [reference, designation, description], (err, results) => {
      if (err) {
        res.status(500).send(`Erreur lors de l'enregistrement du matériel`);
        console.log(err);
      }
      const createdTools= {reference, designation, description}
      res.status(200).json(createdTools);
    });
  });
  
  router.put('/tool/:id', (req, res) => {
    const { id } = req.params;
    db.query(
      'UPDATE utils SET ? WHERE id = ?',
      [req.body, id],
      (err, result) => {
        if (err) res.status(500).send(`Erreur lors de la modification du matériel`);
        res.status(200).send(result);
      }
    );
  });
  
  router.delete('/tool/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM UTILS WHERE id = ?', [id], (err) => {
      if (err) res.status(500).send(`Erreur lors de la suppression du matériel`);
      res.status(200).send('matériel supprimé');
    });
  });
  
  //.................................................................
  // Utilisateur:  Obtenir - Créer - Connecter - Modifier - Supprimer
  //.................................................................
  const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
  
        jwt.verify(token, process.env.JWT_AUTH_SECRET, (err, user) => {
            if (err) {
                return res.status(403).send(err.message);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
  }
  router.get('/user/', authenticateJWT, (req, res) => {
    email= req.user.email
    db.query(`SELECT * FROM user where email=?`,
    [email], (error, result) => {
      if (error) {
        res.status(500).send(error.message);
      } else {
        res.status(200).json(
          result.map((res) => {
            const data = { ...res, password: 'hidden' }
            return data;
          })
        );
      }
    });
  });

  router.get('/userdata/:id', (req, res) => {
    const { id } = req.params;
    db.query(`SELECT * FROM user where user_id=?`,
    [id], (error, result) => {
      if (error) {
        res.status(500).send(error.message);
      } else {
        res.status(200).json(
          result.map((res) => {
            const data = { ...res, password: 'hidden' }
            return data;
          })
        );
      }
    });
  });
  
  router.get('/users/', (req, res) => {
    db.query(`SELECT * FROM user`, (error, result) => {
      if (error) {
        res.status(500).send(error.message);
      } else {
        res.status(200).json(
          result.map((res) => {
            return { ...res, password: 'hidden' };
          })
        );
      }
    });
  });

  router.post('/register', (req, res) => {
    const user = req.body;
    const selectedPassword = user.password;
    const dbPromise = db.promise();
  
    // Check if email is already used
    dbPromise
      .query('SELECT * FROM user WHERE email = ?', user.email)
      .then(([result]) => {
        if (result[0]) return Promise.reject(new Error('DUPLICATE_EMAIL'));
          console.log('doublon')
        // Hash the password (10 salt rounds)
        return (
          bcrypt
            .hash(selectedPassword, 10)
            .then((hash) => {
              console.log('hash')
              if (!hash) return Promise.reject(new Error('HASH_ERROR'));
              user.password = hash;
              console.log('hash done')
              return user;
            })
            // Send it into database
            .then((response) => {
              db.query(
                `INSERT INTO user SET ?`,
                response,
                (err, insertResult) => {
                  console.log('post done')
                  const { user_id } = insertResult;
                  const createdUser = { user_id, ...user };
                  // Hide password
                  createdUser.password = 'hidden';
  
                  // Return the newly created user object
                  res.status(201).json(createdUser);
                }
              );
            })
        );
      })
      .catch(({ message }) => {
        if (message === 'DUPLICATE_EMAIL') {
          res.status(409).json({ message: 'This email is already used' });
        } else if (message === 'HASH_ERROR') {
          res.status(500).json({ message: 'Error durring the hashing process' });
        } else res.status(500).send('Error saving the user');
      });
  });
  
  router.post('/login',  function getApi(req, res) {
    const { email, password } = req.body;
    const dbPromise = db.promise();
      dbPromise.query(`SELECT * FROM user WHERE email = ?`, email)
      .then(([result]) => {
        if (!result.length) return Promise.reject(new Error('USER_NOT_FOUND'));
        // If an user match the giving email, compare with the hashed password and then send a boolean response
        return bcrypt
          .compare(password, result[0].password)
          .then(async (response) => {
            if (!response)
              return Promise.reject(new Error('NO_MATCHING_USER_PASSWORD'));
            const user = { ...result[0] };
            user.password = 'hidden';
            // Create the JsonWebToken with user informations
            const token = jwt.sign(user, process.env.JWT_AUTH_SECRET, {
              expiresIn: 3000,
            });
            return { auth: true, token , user};
          });
      })
      .then((authResponse) => {
        res.status(200).json(authResponse);
      })
      .catch(({ message }) => {
        if (message === 'USER_NOT_FOUND')
          res.status(400).json({ message: 'User not found' });
        if (message === 'NO_MATCHING_USER_PASSWORD') {
          res
            .status(400)
            .json({ message: 'No user matching this email/password' });
        }
      });
  });
  
  router.put('/user/:id', (req, res) => {
    const { id } = req.params;
    db.query(
      'UPDATE user SET ? WHERE user_id = ?',
      [req.body, id],
      (err, result) => {
        if (err) res.status(500).send(`Erreur lors de la modification de l'utilisateur`);
        res.status(200).send(result);
      }
    );
  });
  
  router.delete('/user/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM user WHERE user_id = ?', [id], (err) => {
      if (err) res.status(500).send(`Erreur lors de la suppression de l'utilisateur`);
      res.status(200).send('utilisateur supprimé');
    });
  });
  //...............................................
  // Liste de courses:  Obtenir - Créer - Supprimer
  //...............................................
  router.get('/listReceived/:id', function getApi(req, res) {
    const { id } = req.params;
    db.query(`SELECT * FROM list WHERE to_uuid = ?`, [id], (err, results) => {
      if (err) {
        res.status(500).send('Erreur de traitement de la demande');
        console.log(err);
      }
      res.status(200).json(results);
    });
  });

  router.get('/listSend/:id', function getApi(req, res) {
    const { id } = req.params;
    db.query(`SELECT * FROM list WHERE user_id = ?`, [id], (err, results) => {
      if (err) {
        res.status(500).send('Erreur de traitement de la demande');
        console.log(err);
      }
      res.status(200).json(results);
    });
  });
  
  router.post('/list', function getApi(req, res) {
    const {user_id, to_uuid, content, message, list_name, status}= req.body;
    db.query(`INSERT INTO list (user_id, to_uuid, content, message, list_name, status) VALUES (?,?,?,?,?,?)`, [user_id, to_uuid, content, message, list_name, status], (err, results) => {
      if (err) {
        res.status(500).send(`Erreur lors de l'enregistrement de la liste`);
        console.log(err);
      }
      res.status(200).send('Liste Enregistrée');
    });
  });
  
  router.put('/list/:id', (req, res) => {
    const { id } = req.params;
    db.query(
      'UPDATE list SET ? WHERE list_id = ?',
      [req.body, id],
      (err, result) => {
        if (err) res.status(500).send(`Erreur lors de la modification de l'utilisateur`);
        res.status(200).send(result);
      }
    );
  });


  router.delete('/list/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM list WHERE list_id = ?', [id], (err) => {
      if (err) res.status(500).send(`Erreur lors de la suppression de la liste`);
      res.status(200).send('Liste supprimée');
    });
  });
  // ==============
  // FIN DES ROUTES
  // ==============
  
  module.exports = router;