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
const voca_1 = __importDefault(require("voca"));
class HaniNewsCrawler {
    constructor() { }
    async crawlArticles(day) {
        const categories = ["society", "economy", "politics", "international"];
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - day);
        dateLimit.setHours(0, 0, 0, 0);
        const result = [];
        for (const category of categories) {
            let isDone = false;
            for (let i = 1; !isDone; ++i) {
                const articleUrls = await this.crawlArticleUrls(`https://www.hani.co.kr/arti/${category}/list${i}.html`);
                for (let { link, date } of articleUrls) {
                    if (date < dateLimit) {
                        isDone = true;
                        break;
                    }
                    result.push(await this.getArticle(link));
                }
            }
        }
        return result;
    }
    async crawlArticleUrls(url) {
        const result = [];
        const response = await axios_1.default.get(url);
        const $ = cheerio.load(response.data);
        const list = $("#section-left-scroll-in > div.section-list-area");
        const count = list.children().length;
        for (let i = 2; i <= count; ++i) {
            const obj = {};
            obj["link"] = list
                .find(`div:nth-child(${i}) > div > h4 > a`)
                .prop("href");
            obj["date"] = new Date(list.find(`div:nth-child(${i}) > div > p > span`).text());
            obj["link"] = new URL(obj["link"], url).href;
            result.push(obj);
        }
        return result;
    }
    async getArticle(url) {
        const response = await axios_1.default.get(url);
        const $ = cheerio.load(response.data);
        const emailRegex = /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
        const reporterRegex = /\S* 기자$/g;
        const result = {};
        result["press"] = "hankyoreh";
        result["url"] = url;
        result["headline"] = $("#article_view_headline > h4 > span").text().trim();
        result["subtitle"] = $("#a-left-scroll-in > div.article-text > div > div.subtitle").text().trim().replaceAll("\n", "");
        result["createdAt"] = $("#article_view_headline > p.date-time > span:nth-child(1)").text().trim();
        result["modifiedAt"] = $("#article_view_headline > p.date-time > span:nth-child(2)").text().trim();
        result["image"] = `https:${$("#a-left-scroll-in > div.article-text > div > div.text > .image-area > .imageC > .image > img")[0]?.attribs?.src}`;
        result["reporterName"] = $("meta[property='dd:author']")[0]?.attribs?.content?.split(",")[0];
        result["mail"] = $("#a-left-scroll-in > div.article-text > div > div.text > a[href^='mailto']").text();
        [
            "#ad_tag",
            "script",
            ".desc",
            "#ADOP_V_yFm9GAZdAl",
            "#news-box",
            "#news-box2",
            "#news-box3",
            "#news-box4",
        ].forEach((el) => $(el).remove());
        const temp = voca_1.default.stripTags($("#a-left-scroll-in > div.article-text > div > div.text").html(), ["img"], "<br>");
        const paragraphs = temp.replaceAll("&lt;", "<").replaceAll("&gt;", ">");
        const regex = /src\s*=\s*"([^"]+)"/;
        result["paragraphs"] = paragraphs
            .split("<br>")
            .map((el) => el.trim())
            .filter((el) => el !== '')
            .map((el) => {
            if (el.indexOf("src")) {
                const src = regex.exec(el);
                if (src) {
                    el = `https:${src[1]}`;
                }
            }
            return el;
        });
        return result;
    }
}
new HaniNewsCrawler().crawlArticles(1).then((articles) => {
    fs.writeFileSync("hankyoreh.json", JSON.stringify(articles, null, 2));
});
//# sourceMappingURL=hankyoreh.js.map