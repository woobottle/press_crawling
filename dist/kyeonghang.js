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
class KhanNewsCrawler {
    constructor() { }
    async crawlArticles(day) {
        const categories = ["politics", "national", "world",];
        'http://biz.khan.co.kr/khan_art_list.html?category=economy&page=1';
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - day);
        dateLimit.setHours(0, 0, 0, 0);
        const result = [];
        let isDone = false;
        for (let i = 1; !isDone; ++i) {
            const articleUrls = await this.crawlArticleUrls(`http://news.khan.co.kr/kh_news/khan_art_list.html?code=910000&page=${i}`);
            for (let { link, date } of articleUrls) {
                if (date < dateLimit) {
                    isDone = true;
                    break;
                }
                result.push(await this.getArticle(link));
            }
        }
        return result;
    }
    async crawlArticleUrls(url) {
        const result = [];
        const response = await axios_1.default.get(url);
        const $ = cheerio.load(response.data);
        const list = $("#listWrap > div > div.news_list > ul");
        const count = list.children().length;
        for (let i = 1; i <= count; ++i) {
            const obj = {};
            obj["link"] = list.find(`li:nth-child(${i}) > strong > a`).prop("href");
            obj["date"] = new Date(list.find(`li:nth-child(${i}) > span.byline > em.letter`).text());
            obj["link"] = new URL(obj["link"], url).href;
            result.push(obj);
        }
        return result;
    }
    async getArticle(url) {
        const response = await axios_1.default.request({
            method: "GET",
            url: url,
            responseType: "arraybuffer",
            responseEncoding: "binary",
        });
        const $ = cheerio.load(iconv.decode(response.data, "euc-kr"));
        const result = {};
        result["press"] = "khan";
        result["url"] = url;
        result["headline"] = $("#article_title").text().trim();
        result["subtitle"] = "";
        result["time"] = $("#container > div.art_header.borderless > div.function_wrap > div.pagecontrol > div > em:nth-child(1)")
            .text()
            .trim();
        result["modifiedtime"] = $("#container > div.art_header.borderless > div.function_wrap > div.pagecontrol > div > em:nth-child(2)")
            .text()
            .trim();
        result["body"] = $("#articleBody").html().trim();
        const line = $("#container > div.art_header.borderless > div.subject > span > a")
            .text()
            .trim()
            .split(" ");
        result["reporter"] = line[0];
        result["mail"] = line[line.length - 1];
        return result;
    }
}
new KhanNewsCrawler().crawlArticles(1).then((articles) => {
    fs.writeFileSync("khan.json", JSON.stringify(articles, null, 2));
});
//# sourceMappingURL=kyeonghang.js.map