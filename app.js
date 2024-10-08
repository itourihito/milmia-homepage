const dotenv = require('dotenv');
if (process.env.NODE_ENV !== 'production') {
    const result = dotenv.config();
    if (result.error) {
        console.error("Error loading .env file:", result.error);
    } else {
        console.log("Environment variables loaded:", result.parsed);
    }
}

const express = require("express");
const nodemailer = require('nodemailer');
const { engine } = require("express-handlebars");
const Handlebars = require('handlebars'); 
const bodyParser = require('body-parser');
const config = require('./config');
const { pool } = require('./config');
const app = express();

const PORT = process.env.PORT || 8080;


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.email.user,
        pass: config.email.pass
    }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const hbs = engine({
    defaultLayout: 'main',
    extname: '.hbs',
    helpers: {
      breaklines: function (text) {
        let escapedText = Handlebars.Utils.escapeExpression(text); // XSS対策
        return new Handlebars.SafeString(escapedText.replace(/(\r\n|\n|\r)/gm, '<br>'));
      }
    }
  });
app.engine('hbs', hbs);
app.set('view engine', 'hbs');


app.get("/", (req, res) => {
    let queryNews = 'SELECT * FROM news ORDER BY date DESC LIMIT 3'; // ニュースを取得するSQLクエリ
    let queryStreamers = 'SELECT * FROM livers where pick = 1'; // ストリーマーを取得するSQLクエリ

    pool.query(queryNews, (err, newsResults) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }
        pool.query(queryStreamers, (err, streamersResults) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Internal Server Error");
            }
            res.render('home', {
                news: newsResults.rows,
                livers: streamersResults.rows,
                style: 'home',
                script: "home"
            });
        });
    });
});

app.get("/livers", (req, res) => {
    pool.query('SELECT * FROM livers', (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send("Internal Server Error");
        }
        res.render('livers', {
            livers: results.rows,
            style: "livers"
        });
    });
});

app.get("/liver/:name_id", (req, res) => {
    const liverId = req.params.name_id;
    let query = 'SELECT * FROM livers WHERE name_id = $1';
    pool.query(query, [liverId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }
        res.render("liver", {
            liver: result.rows[0],
            style: "liver"
        });
    });
});

app.get("/news", (req, res) => {
    pool.query('SELECT * FROM news ORDER BY date DESC', (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send("Internal Server Error");
        }
        res.render('news', {
            news: results.rows,
            style: "news"
        });
    });
});

app.get("/topic/:id", (req, res) => {
    const topicId = req.params.id;
    let query = 'SELECT * FROM news WHERE id = $1';
    pool.query(query, [topicId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }
        res.render("topic", {
            news: result.rows[0],
            style: "topic"
        });
    });
});

app.get("/audition", (req, res) => {
    res.render("audition", {
        style: "audition"
    });
});

app.post('/audition', (req, res) => {
    const { name, email, message } = req.body;
    const applicantMailOptions = {
        from: config.email.user,
        to: email,
        subject: '応募の確認',
        text: `こんにちは ${name}さん。\n\nあなたの応募を受け付けました。`
    };

    const companyMailOptions = {
        from: config.email.user,
        to: config.email.user,
        subject: '新しい求人応募',
        text: `こんにちは。\n\n${name}さんからの新しい応募がありました。\n\n${email}`
    };

    let query = 'INSERT INTO auditions (name, email, message) VALUES ($1, $2, $3)';
    pool.query(query, [name, email, message], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }
        transporter.sendMail(applicantMailOptions, (error, info) => {
            if (error) {
                console.log('メール送信エラー:', error);
            } else {
                console.log('メール送信成功:', info.response);
            }
        });
        transporter.sendMail(companyMailOptions, (error) => {
            if (error) {
                console.log('会社へのメール送信エラー:', error);
            }
        });
        res.redirect('/auditionSuc');
    });
});

app.get("/auditionSuc", (req, res) => {
    res.render("auditionSuc", {
        style: "auditionSuc"
    });
});

app.get("/contact", (req, res) => {
    res.render("contact", {
        style: "contact"
    });
});

app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    const applicantMailOptions = {
        from: config.email.user,
        to: email,
        subject: 'メッセージ送信の確認',
        text: `こんにちは ${name}さん。\n\nあなたのメッセージを受け付けました。`
    };

    const companyMailOptions = {
        from: config.email.user,
        to: config.email.user,
        subject: '新しいメッセージ',
        text: `こんにちは。\n\n${name}さんからの新しいメッセージがありました。\n\n${email}\n\n${message}`
    };

    let query = 'INSERT INTO contacts (name, email, message) VALUES ($1, $2, $3)';
    pool.query(query, [name, email, message], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }
        transporter.sendMail(applicantMailOptions, (error, info) => {
            if (error) {
                console.log('メール送信エラー:', error);
            } else {
                console.log('メール送信成功:', info.response);
            }
        });
        transporter.sendMail(companyMailOptions, (error) => {
            if (error) {
                console.log('会社へのメール送信エラー:', error);
            }
        });
        res.redirect('/contactSuc');
    });
});

app.get("/contactSuc", (req, res) => {
    res.render("contactSuc", {
        style: "contactSuc"
    });
});
app.get("/PrivacyPolicy", (req, res) => {
    res.render("PrivacyPolicy", {
        style: "PrivacyPolicy"
    });
});
app.listen(PORT, () => console.log(`サーバー起動: ポート${PORT}`));
