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
class JoongangNewsCrawler {
    constructor() { }
    async crawlArticles(day) {
        const categories = ["politics", "money", "society", "world"];
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - day);
        dateLimit.setHours(0, 0, 0, 0);
        const result = [];
        for (const category of categories) {
            let isDone = false;
            for (let i = 1; !isDone; ++i) {
                const articleUrls = await this.crawlArticleUrls(`https://news.joins.com/${category}?page=${i}`);
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
        const list = $("#content > div.list_basic.list_sectionhome > ul");
        const count = list.children().length;
        for (let i = 1; i <= count; ++i) {
            const obj = {};
            obj["link"] = list.find(`li:nth-child(${i}) > h2 > a`).attr("href");
            obj["date"] = new Date(list.find(`li:nth-child(${i}) > span.byline`).text());
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
        result["press"] = "joongang";
        result["url"] = url;
        result["headline"] = $("#article_title").text().trim();
        result["subtitle"] = $(".ab_subtitle").text().trim();
        result["createdAt"] = $("#body > div.article_head > div.clearfx > div.byline > em:nth-child(2)").text().trim();
        result["modifiedAt"] = $("#body > div.article_head > div.clearfx > div.byline > em:nth-child(3)").text().trim();
        result["image"] = $(".ab_photo.photo_center > .image > img")[0]?.attribs?.src || '';
        const [reporterName, mail] = $(".ab_byline")?.text()?.split(" ")?.filter((el) => el !== "기자");
        result["reporterName"] = reporterName;
        result["mail"] = mail;
        ["#ja_read_tracker", "#criteo_network", ".ab_subtitle"].forEach((el) => $(el).remove());
        result["paragraphs"] = $("#article_body")
            .html()
            ?.split("<br>")
            ?.map((el) => {
            return el.replaceAll("\n", "").replaceAll("&nbsp;", '').trim();
        })
            ?.filter((el) => el !== "&nbsp;")
            ?.filter((el) => el !== "");
        return result;
    }
}
new JoongangNewsCrawler().crawlArticles(1).then((articles) => {
    fs.writeFileSync("joongang.json", JSON.stringify(articles, null, 2));
});
//# sourceMappingURL=joongang.js.map