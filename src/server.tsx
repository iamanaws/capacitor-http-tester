import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import multer from "multer";

const app = express();
const upload = multer();
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.header("Origin") ?? "*");
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Headers", "Content-Type, X-Some-Header");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (req.method == "OPTIONS") {
        res.sendStatus(204);
        return;
    }

    next();
});
app.use(cookieParser());
app.use(express.urlencoded({extended: true}));

const port = 3000;

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/www/index.html"));
});

app.get("/index.js", (req, res) => {
    res.sendFile(path.join(__dirname, "/www/index.js"));
});

app.post("/api/body/", (req, res) => {
    res.json(req.body);
});

app.get("/api/simple/", (req, res) => {
    res.json({thisThing: "Works"});
});

app.get("/api/headers/", (req, res) => {
    res.json({header: req.headers["x-some-header"]});
});

app.post("/api/multipart/", upload.none(), (req, res) => {
    res.json({result: req.body.doesthiswork});
});

app.get("/api/text/", (req, res) => {
    res.json(
        "I am text, content type should not take precendece over calling response.text()",
    );
});

app.get("/api/number/", (req, res) => {
    res.json(5);
});

app.get("/api/string/", (req, res) => {
    res.json("a string");
});

app.get("/api/null/", (req, res) => {
    res.json(null);
});

app.get("/api/true/", (req, res) => {
    res.json(true);
});

app.get("/api/false/", (req, res) => {
    res.json(false);
});

app.get("/api/cookie/:name/:value/", (req, res) => {
    res.cookie(req.params.name, req.params.value);
    res.json({cookie: "was set"});
});

app.get("/api/read-cookie/:cookieName/", (req, res) => {
    res.json({value: req.cookies[req.params.cookieName]});
});

app.get("/api/blob/", (req, res) => {
    res.sendFile(path.join(__dirname, "/www/cat.jpeg"));
});

app.get("/api/400/", (req, res) => {
    res.status(400).json({thisField: "is required"});
});

app.listen(port, () => {
    console.log(`Test app listening on port ${port}`);
});
