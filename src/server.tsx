import express from "express";
import {execFileSync, spawn} from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import cookieParser from "cookie-parser";
import multer from "multer";

const app = express();
const upload = multer();
const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), "capacitor-http-git-"));
const gitHome = path.join(gitRoot, "home");
const gitConfigHome = path.join(gitRoot, "config");
const gitReposRoot = path.join(gitRoot, "repos");
const gitWorktree = path.join(gitRoot, "worktree");
const gitRepoName = "floccus-repro.git";
const gitEnv = {
    ...process.env,
    HOME: gitHome,
    XDG_CONFIG_HOME: gitConfigHome,
    GIT_CONFIG_GLOBAL: path.join(gitRoot, "empty-gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
};
const git = (args: string[], cwd?: string) =>
    execFileSync("git", args, {
        cwd,
        env: gitEnv,
    });

fs.mkdirSync(gitHome);
fs.mkdirSync(gitConfigHome);
fs.mkdirSync(gitReposRoot);
fs.mkdirSync(gitWorktree);
fs.writeFileSync(gitEnv.GIT_CONFIG_GLOBAL, "");
git(["init", "--initial-branch", "main"], gitWorktree);
git(["config", "user.email", "tester@example.com"], gitWorktree);
git(["config", "user.name", "Capacitor Tester"], gitWorktree);
fs.writeFileSync(path.join(gitWorktree, "README.md"), "floccus git repro\n");
git(["add", "README.md"], gitWorktree);
git(["commit", "-m", "Initial commit"], gitWorktree);
git(["init", "--bare", "--initial-branch", "main", path.join(gitReposRoot, gitRepoName)]);
git(["remote", "add", "origin", path.join(gitReposRoot, gitRepoName)], gitWorktree);
git(["push", "origin", "HEAD:main"], gitWorktree);

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.header("Origin") ?? "*");
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Some-Header");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Expose-Headers", "Content-Length, Content-Type");

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

app.all(/^\/git\/.*/, (req, res) => {
    const child = spawn("git", ["http-backend"], {
        env: {
            ...gitEnv,
            GIT_HTTP_EXPORT_ALL: "1",
            GIT_PROJECT_ROOT: gitReposRoot,
            PATH_INFO: req.path.replace(/^\/git/, ""),
            QUERY_STRING: req.url.split("?")[1] ?? "",
            REQUEST_METHOD: req.method,
            CONTENT_TYPE: req.header("content-type") ?? "",
            CONTENT_LENGTH: req.header("content-length") ?? "",
        },
    });

    let headerBuffer = Buffer.alloc(0);
    let headersSent = false;

    child.stdout.on("data", (chunk: Uint8Array) => {
        const buffer = Buffer.from(chunk);
        if (headersSent) {
            res.write(buffer);
            return;
        }

        headerBuffer = Buffer.from([...headerBuffer, ...buffer]);
        const separator = headerBuffer.indexOf("\r\n\r\n");
        if (separator == -1) {
            return;
        }

        const rawHeaders = headerBuffer.subarray(0, separator).toString("utf8");
        const body = headerBuffer.subarray(separator + 4);
        for (const line of rawHeaders.split("\r\n")) {
            const [name, ...valueParts] = line.split(":");
            const value = valueParts.join(":").trim();
            if (name.toLowerCase() == "status") {
                res.status(Number(value.split(" ")[0]));
            } else if (name != "") {
                res.setHeader(name, value);
            }
        }
        headersSent = true;
        res.write(body);
    });

    child.stderr.on("data", (chunk: Uint8Array) => {
        console.error(Buffer.from(chunk).toString("utf8"));
    });

    child.on("close", () => {
        res.end();
    });

    req.pipe(child.stdin);
});

app.post("/api/body/", (req, res) => {
    res.json(req.body);
});

app.post("/api/binary/", express.raw({type: "*/*"}), (req, res) => {
    res.json({
        contentType: req.header("content-type"),
        length: req.body.length,
        text: req.body.toString("utf8"),
    });
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
