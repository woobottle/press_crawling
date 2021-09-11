import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import v from "voca";

class ChosunCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const categories = ["politics", "natinoal", "economy", "international"];

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];
    for (const category of categories) {
      let isDone = false;
      for (let i = 0; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(
          `https://www.chosun.com/pf/api/v3/content/fetch/story-feed?query={"excludeContentTypes":"video","excludeSections":"","includeContentTypes":"story","includeSections":"/${category}","offset":${
            i * 10
          },"size":10}&filter={content_elements{_id,canonical_url,display_date,count,next}&d=654&_website=chosun`
        );

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

  private async crawlArticleUrls(url: string) {
    const result = [];
    const response = await axios.get(url).then((resp) => resp.data);
    const list = response.content_elements;
    
    list.forEach((el, index) => {
      const {canonical_url: link, display_date: date} = el;
      const obj = {};

      obj["link"] = `https://www.chosun.com${link}`;
      obj["date"] = date;
      result.push(obj);
    })
    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const emailRegex =
      /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
    const result = {};

    result["press"] = "chosun";
    result["url"] = url;
    result["headline"] = $("meta[property='og:title']")[0].attribs.content;
    const test = $("#fusion-metadata")[0].children[0] // [0].children[0].data;
    const testScripts = (test as any).data
    const testContents = testScripts
      .substring(testScripts.indexof("Fusion.globalContent"))
      .replace("Fusion.globalContent", "");
    const testJson = JSON.parse(testContents);
    result["subtitle"] = $("#fusion-metadata")
      .text()
      .trim()
      .replaceAll("\n", "");
    result["createdAt"] = $(
      "#container > div.article_title > div.title_foot > span:nth-child(2)"
    )
      .text()
      .trim();
    result["modifiedAt"] = $(
      "#container > div.article_title > div.title_foot > span:nth-child(3)"
    )
      .text()
      .trim();
    result["image"] = $("meta[property='og:image']")[0].attribs.content;

    const [reporterName, , reporterMail] = $(
      "meta[property='dd:author']"
    )[0]?.attribs?.content?.split(" ");
    result["reporterName"] = reporterName;
    result["mail"] = reporterMail?.replace("제공", "") || "";

    [
      ".armerica_ban",
      ".article_relation",
      ".center_ban",
      ".right_ban",
      ".txt_ban",
      ".btn_page",
      "#bestnews_layer",
      ".article_keyword",
      "script",
      ".sub_title",
    ].forEach((el) => $(el).remove());
    const paragraphs = v.stripTags(
      $("#content > div > div.article_txt").html(),
      ["img"],
      "<br>"
    );

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

new ChosunCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("chosun.json", JSON.stringify(articles, null, 2));
});
