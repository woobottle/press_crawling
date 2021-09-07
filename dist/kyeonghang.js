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
class KhanNewsCrawler {
    constructor() { }
    async crawlArticles(day) {
        const categories = [
            ["정치", "politics"],
            ["사회", "national"],
            ["국제", "world"],
        ];
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - day);
        dateLimit.setHours(0, 0, 0, 0);
        const result = [];
        for (const [name, category] of categories) {
            let isDone = false;
            for (let i = 1; !isDone; ++i) {
                const articleUrls = await this.crawlArticleUrls("https://www.khan.co.kr/SecListData.html", category, i);
                for (let { link, date } of articleUrls) {
                    console.log('00000', link, date);
                    if (date < dateLimit) {
                        isDone = true;
                        break;
                    }
                    result.push(await this.getArticle(link, name));
                }
            }
        }
        let isDone = false;
        for (let i = 1; !isDone; ++i) {
            const articleUrls = await this.getEconomyArticleUrls(`http://biz.khan.co.kr/khan_art_list.html?category=market&page=${i}`);
            for (let { link, date } of articleUrls) {
                console.log('12313', link, date);
                if (date < dateLimit) {
                    isDone = true;
                    break;
                }
                result.push(await this.getArticle(link, "경제"));
            }
        }
        return result;
    }
    async crawlArticleUrls(url, category, page) {
        const result = [];
        const data = `syncType=async&type=${category}&year=2021&month=9&day=&category=&category2=&page=${page}&code=&serial=&search_keyword=`;
        const config = {
            method: "post",
            url,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            data,
        };
        const response = await axios_1.default(config).then((response) => response.data);
        const list = response.items;
        const count = list.length;
        list.forEach((el, index) => {
            const { art_id, url } = el;
            const obj = {};
            obj["link"] = url;
            obj["date"] = new Date(`${art_id.slice(0, 4)} ${art_id.slice(4, 6)} ${art_id.slice(6, 8)} ${art_id.slice(8, 10)}:${art_id.slice(10, 12)}`);
            obj["link"] = new URL(obj["link"], url).href;
            result.push(obj);
        });
        return result;
    }
    async getEconomyArticleUrls(url) {
        const result = [];
        const response = await axios_1.default.get(url);
        const $ = cheerio.load(response.data);
        const list = $(".content_Wrap > div.news_list > ul");
        const count = list.children().length;
        for (let i = 1; i <= count; ++i) {
            const obj = {};
            obj["link"] = list.find(`li:nth-child(${i}) > div > strong > a`).prop("href");
            obj["date"] = new Date(list.find(`li:nth-child(${i}) > div > span.byline > em.letter`).text());
            obj["link"] = new URL(obj["link"], url).href;
            result.push(obj);
        }
        return result;
    }
    async getArticle(url, categoryName) {
        const response = await axios_1.default.request({
            method: "GET",
            url: url,
            responseType: "arraybuffer",
            responseEncoding: "binary",
        });
        const $ = cheerio.load(iconv.decode(response.data, "euc-kr"));
        const result = {};
        result["press"] = "경향신문";
        result["url"] = url;
        result["headline"] = $(".headline").text().trim();
        result["subtitle"] = "";
        result["createdAt"] = $(".art_header > .function_wrap > .art_info > .byline > em:nth-child(1)")
            .text()
            .trim();
        result["modifiedAt"] = $(".art_header > .function_wrap > .art_info > .byline > em:nth-child(2)")
            .text()
            .trim();
        const [reporterName, reporterMail] = $("meta[property='article:author']")[0].attribs.content.split("/");
        result["reporterName"] = reporterName;
        result["mail"] = reporterMail?.replace("제공", "") || "";
        result["image"] = "https:" + $("#articleBody > div.art_photo > div.art_photo_wrap > picture > img")[0]?.attribs?.src;
        result["category_name"] = categoryName;
        ["style", ".iwmads", ".article_bottom_ad", "#ads5PgPv", "script"].forEach((el) => $(el).remove());
        const paragraphs = voca_1.default.stripTags($(".art_cont > .art_body").html(), ["img"], "<br>");
        const regex = /src\s*=\s*"([^"]+)"/;
        result["paragraphs"] = paragraphs
            .split("<br>")
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
        });
        return result;
    }
}
new KhanNewsCrawler().crawlArticles(1).then((articles) => {
    fs.writeFileSync("khan.json", JSON.stringify(articles, null, 2));
});
//# sourceMappingURL=kyeonghang.js.map