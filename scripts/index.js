const crypto = require('crypto');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const textToSVG = require('text-to-svg');
const { createCanvas } = require('canvas');
const sharp = require('sharp');
const cors = require('cors');
const express = require('express');
const app = express();
const port = 3000;
const imageDir = 'images';

// 字体风格数组
const fontStyles = ['serif', 'sans-serif'];

class Url {
    constructor(host, path, schema) {
        this.host = host;
        this.path = path;
        this.schema = schema;
    }
}

function sha256base64(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('base64');
}

function parse_url(request_url) {
    const url = new URL(request_url);
    return new Url(url.hostname, url.pathname, url.protocol);
}

function assemble_ws_auth_url(request_url, method = "GET", api_key = "", api_secret = "") {
    const u = parse_url(request_url);
    const host = u.host;
    const path = u.path;
    const now = new Date();
    const date = now.toUTCString();
    const signature_origin = `host: ${host}\ndate: ${date}\n${method} ${path} HTTP/1.1`;
    const signature_sha = crypto.createHmac('sha256', api_secret).update(signature_origin).digest('base64');
    const authorization_origin = `api_key="${api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature_sha}"`;
    const authorization = Buffer.from(authorization_origin).toString('base64');
    const values = {
        "host": host,
        "date": date,
        "authorization": authorization
    };
    return request_url + "?" + querystring.stringify(values);
}

function getImageBody(appid, content) {
    return {
        "header": {
            "app_id": appid
        },
        "parameter": {
            "chat": {
                "domain": "general",
            }
        },
        "payload": {
            "message": {
                "text": [
                    {
                        "role": "user",
                        "content": content
                    }
                ]
            }
        }
    };
}

async function generateImage(text, appid, apikey, apisecret) {
    const host = 'http://spark-api.cn-huabei-1.xf-yun.com/v2.1/tti';
    const url = assemble_ws_auth_url(host, 'POST', apikey, apisecret);
    const content = getImageBody(appid, text);
    const response = await axios.post(url, content, { headers: { 'content-type': "application/json" } });
    return response.data;
}

function base64_to_image(base64_data, save_path) {
    const img_data = Buffer.from(base64_data, 'base64');
    fs.writeFileSync(save_path, img_data);
}

async function deleteImage(imagePath) {
    try {
        await fs.promises.unlink(imagePath);
        // console.log(`图片 ${imagePath} 已被删除`);
    } catch (error) {
        // console.error(`删除图片时出错: ${error}`);
    }
}
// 生成随机颜色
function getRandomColor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r},${g},${b})`;
}
async function processImage(imagePath, title) {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    const aspectRatio = 900 / 383;
    const width = Math.min(metadata.width, metadata.height * aspectRatio);
    const height = width / aspectRatio;

    const left = (metadata.width - width) / 2;
    const top = (metadata.height - height) / 2;

    const newImagePath = imagePath.replace('.jpg', `_${title}.jpg`);

    // 创建 Canvas 文本
    const canvas = createCanvas(900, 383);
    const context = canvas.getContext('2d');

    // 创建渐变色
    const gradient = context.createLinearGradient(0, 0, 900, 0);
    gradient.addColorStop(0, getRandomColor());
    gradient.addColorStop(1, getRandomColor());
    gradient.addColorStop(2, getRandomColor());

    const fontSize = Math.sqrt((0.2 * 900 * 383) / title.length);
    // 随机选择字体风格
    const randomFontStyle = fontStyles[Math.floor(Math.random() * fontStyles.length)];

    context.fillStyle = gradient;
    context.font = `bold ${fontSize}px ${randomFontStyle}`;
    context.textAlign = 'center';
    // 计算文本的宽度和高度
    const textMetrics = context.measureText(title);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    console.log(`textWidth: ${textWidth}, textHeight: ${textHeight}`);
    // 计算文本的位置以使其居中
    const textX = 900 / 2;
    const textY = 383 / 2 + textHeight / 3;

    context.shadowColor = getRandomColor();  // 随机阴影颜色
    context.shadowBlur = Math.random() * 50;  // 随机阴影大小
    context.fillText(title, textX, textY);
    const textBuffer = canvas.toBuffer();

    await image
        .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
        .resize(900, 383)
        .composite([{ input: textBuffer, gravity: 'center' }])
        .toFile(newImagePath);

    return newImagePath;
}

async function parser_Message(message, title) {
    const data = message;
    const code = data['header']['code'];
    let savePath = null;
    if (code != 0) {
        console.log(`请求错误: ${code}, ${data}`);
    } else {
        const text = data["payload"]["choices"]["text"];
        const imageContent = text[0];
        const imageBase = imageContent["content"];
        const date = new Date();
        const timestamp = date.getTime();
        const imageName = `WC_${timestamp}`;
        savePath = `${imageDir}/${imageName}.jpg`;
        base64_to_image(imageBase, savePath);
        const croppedImagePath = await processImage(savePath, title);
        await deleteImage(savePath);
        savePath = croppedImagePath;
        console.log(`图片已保存到: ${savePath}`);
    }
    return savePath;
}

function isImage(file) {
    const ext = path.extname(file).toLowerCase();
    return ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif';
}

function getFullPath(dir, file) {
    return path.join(dir, file);
}

function getImages(req, res) {
    fs.readdir(imageDir, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            res.status(500).send('Server error');
            return;
        }

        const imageFiles = files.filter(file => isImage(file) && file.startsWith('WC_'));
        const imagePaths = imageFiles.map(file => getFullPath(imageDir, file));

        // console.log(imagePaths);
        res.json({ imagePaths: imagePaths });
    });
}


app.use(cors()); // 这将为所有的请求设置 'Access-Control-Allow-Origin' 头部
app.use(express.json()); // 用于解析 JSON 请求体
app.use(express.urlencoded({ extended: true })); // 用于解析 URL 编码的请求体

app.get('/get-images', async (req, res) => {
    getImages(req, res);
});

app.post('/generate-image', async (req, res) => {
    const APPID = '71a635e5';
    const APISecret = 'ZTNjNTUwNTc2ZWNmNDA0NDEzMDA3NTdi';
    const APIKEY = '54ad2981520d3eebb1cc5a70ecca95bd';
    const desc = req.body.text;
    const result = await generateImage(desc, APPID, APIKEY, APISecret);
    const imageUrl = parser_Message(result, req.body.title);
    console.log('imageUrl: ' + imageUrl);
    res.json({ imageUrl: imageUrl });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});