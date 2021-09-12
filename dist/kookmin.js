"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const cheerio = __importStar(require("cheerio"));
const iconv = __importStar(require("iconv-lite"));
const voca_1 = __importDefault(require("voca"));
const moment_1 = __importDefault(require("moment"));
class KookminNewsCrawler {
    constructor() { }
    async crawlArticles(day) {
        const categories = [
            ["정치", "pol"],
            ["경제", "eco"],
            ["사회", "soc"],
            ["국제", "int"],
        ];
        const date = moment_1.default().format("YYYYMMDD");
        const result = [];
        for (const [categoryName, category] of categories) {
            let isDone = false;
            for (let i = 1; !isDone; ++i) {
                const articleUrls = await this.crawlArticleUrls(`http://news.kmib.co.kr/article/list.asp?sid1=${category}&sid2=&page=${i}&sdate=${date}&st=`);
                for (let { link, image } of articleUrls) {
                    result.push(await this.getArticle(link, categoryName, image));
                }
                if (articleUrls.length !== 40) {
                    isDone = true;
                    break;
                }
            }
        }
        return result;
    }
    async crawlArticleUrls(url) {
        const result = [];
        const response = await axios_1.default.request({
            method: "GET",
            url: url,
            responseType: "arraybuffer",
            responseEncoding: "binary",
        });
        const decodeType = "euc-kr";
        const $ = cheerio.load(iconv.decode(response.data, decodeType));
        const list = $(".nws_list");
        const count = list[0].children.length;
        for (let i = 1; i <= count; ++i) {
            const obj = {};
            obj["link"] = `http://news.kmib.co.kr/article/${list
                .find(`div:nth-child(${i}) > dl.nws > dt > a`)
                .attr("href")}`;
            obj["date"] = new Date(list.find(`div:nth-child(${i}) > dl.nws > dd.date`).text());
            obj["image"] = list.find(`div:nth-child(${i}) > p.pic > a > img`)[0]?.attribs?.src || '';
            console.log(i, list
                .find(`div:nth-child(${i}) > dl.nws > dt > a`)
                .attr("href"));
            result.push(obj);
        }
        return result;
    }
    async getArticle(url, categoryName, image) {
        const response = await axios_1.default.request({
            method: "GET",
            url: url,
            responseType: "arraybuffer",
            responseEncoding: "binary",
        });
        const decodeType = "euc-kr";
        const $ = cheerio.load(iconv.decode(response.data, decodeType));
        const emailRegex = /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
        const reporterRegex = /\S* 기자$/g;
        const result = {};
        result["press"] = "kookmin";
        result["url"] = url;
        result["category-name"] = categoryName;
        result["image"] = image;
        result["headline"] = $("meta[name='title']")[0].attribs.content;
        const [createdAt, modifiedAt] = $(".nwsti_btm > .date").text().trim().split("/");
        result["createdAt"] = createdAt;
        result["modifiedAt"] = modifiedAt;
        result["reporterName"] = $("meta[property='dable:author']").text().trim();
        result["mail"] = "";
        ["style", "script", "figcaption", "img[alt='국민일보 신문구독']"].forEach((el) => $(el).remove());
        const temp = voca_1.default.stripTags($(".nws_arti > #articleBody").html(), ["img", "span"], "<br>");
        const paragraphs = temp
            .replaceAll("<b>", "")
            .replaceAll("</b>", "")
            .replaceAll("<span>", "")
            .replaceAll("</span>", "")
            .trim()
            .replaceAll("&nbsp;", "");
        const regex = /src\s*=\s*"([^"]+)"/;
        result["paragraphs"] = paragraphs
            .split("<br><br>")
            .map((el) => el.replaceAll("<br>", ""))
            .map((el) => el.trim())
            .filter((el) => el !== "")
            .map((el) => {
            if (el.indexOf("src")) {
                const src = regex.exec(el);
                if (src) {
                    el = src[1];
                }
            }
            return el;
        })
            .filter((el) => el !== "");
        return result;
    }
}
new KookminNewsCrawler().crawlArticles(1).then((articles) => {
    fs.writeFileSync("kookmin.json", JSON.stringify(articles, null, 2));
});
//# sourceMappingURL=kookmin.js.map