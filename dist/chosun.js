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
class ChosunCrawler {
    constructor() { }
    async crawlArticles(day) {
        const categories = [['정치', 'politics'], ['사회', 'national'], ['경제', 'economy'], ['국제', 'international']];
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - day);
        dateLimit.setHours(0, 0, 0, 0);
        const result = [];
        for (const [categoryName, category] of categories) {
            let isDone = false;
            for (let i = 0; !isDone; ++i) {
                const articleUrls = await this.crawlArticleUrls(`https://www.chosun.com/pf/api/v3/content/fetch/story-feed?query={"excludeContentTypes":"video","excludeSections":"","includeContentTypes":"story","includeSections":"/${category}","offset":${i * 10},"size":10}&filter={content_elements{_id,canonical_url,display_date,count,next, promo_items{basic{url, resizedUrls{16x9_lg,16x9_md,16x9_sm},subtype,type,url,width}}}&d=654&_website=chosun`);
                for (let { link, date, image } of articleUrls) {
                    if (date < dateLimit) {
                        isDone = true;
                        break;
                    }
                    result.push(await this.getArticle(link, image, categoryName));
                }
            }
        }
        return result;
    }
    async crawlArticleUrls(url) {
        const result = [];
        const response = await axios_1.default.get(url).then((resp) => resp.data);
        const list = response.content_elements;
        list.forEach((el, index) => {
            const { canonical_url: link, display_date: date, promo_items } = el;
            const obj = {};
            obj["link"] = `https://www.chosun.com${link}`;
            obj["date"] = new Date(date);
            obj["image"] = promo_items?.basic?.resizedUrls["16x9_lg"] || '';
            result.push(obj);
        });
        return result;
    }
    async getArticle(url, image, categoryName) {
        const response = await axios_1.default.get(url);
        const $ = cheerio.load(response.data);
        const emailRegex = /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
        const result = {};
        const metadata = $("#fusion-metadata")[0].children[0];
        const metadataScripts = metadata.data;
        const lastIndex = metadataScripts.indexOf(";Fusion.globalContentConfig=");
        const metadataContents = metadataScripts
            .substring(metadataScripts.indexOf("Fusion.globalContent"), lastIndex)
            .replace("Fusion.globalContent=", "")
            .replace(";Fusion.spa=false;Fusion.spaEnabled=false;", "");
        const articleJson = JSON.parse(metadataContents);
        const { headlines, subheadlines, display_date, created_date, last_updated_date, first_publish_date, credits, content_elements } = articleJson;
        result["press"] = '조선일보';
        result["url"] = url;
        result["headline"] = voca_1.default.stripTags(headlines.basic) || '';
        result["subtitle"] = voca_1.default.stripTags(subheadlines.basic) || '';
        result["createdAt"] = display_date || created_date;
        result["modifiedAt"] = last_updated_date || first_publish_date;
        result["image"] = image;
        result["category_name"] = categoryName;
        const reporter = credits.by[0] || '';
        const { original } = reporter.additional_properties || '';
        result["reporterName"] = original?.byline || '';
        result["reporterMail"] = original?.email || '';
        const paragraphs = content_elements.map((el) => {
            if (el.type === 'image') {
                return el.resizedUrls.article_lg;
            }
            else if (el.type === 'raw_html') {
                return '';
            }
            return voca_1.default.stripTags(el.content);
        });
        result["paragraphs"] = paragraphs.filter((el) => el !== "");
        return result;
    }
}
new ChosunCrawler().crawlArticles(1).then((articles) => {
    fs.writeFileSync("chosun.json", JSON.stringify(articles, null, 2));
});
//# sourceMappingURL=chosun.js.map