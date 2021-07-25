import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";

class JoongangNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];

    let isDone = false;
    for (let i = 1; !isDone; ++i) {
      const articleUrls = await this.crawlArticleUrls(
        `https://news.joins.com/politics?page=${i}`
      );

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

  private async crawlArticleUrls(url: string) {
    const result = [];

    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const list = $("#content > div.list_basic.list_sectionhome > ul");
    const count = list.children().length;

    for (let i = 1; i <= count; ++i) {
      const obj = {};
      obj["link"] = list.find(`li:nth-child(${i}) > h2 > a`).attr("href");
      obj["date"] = new Date(
        list.find(`li:nth-child(${i}) > span.byline`).text()
      );

      result.push(obj);
    }

    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const result = {};

    result["press"] = "joongang";
    result["url"] = url;
    result["headline"] = $("#article_title").text().trim();
    result["time"] = $(
      "#body > div.article_head > div.clearfx > div.byline > em:nth-child(2)"
    )
      .text()
      .trim();
    result["modifiedtime"] = $(
      "#body > div.article_head > div.clearfx > div.byline > em:nth-child(3)"
    )
      .text()
      .trim();
    result["body"] = $("#article_body").html().trim();

    const paragraphs = result["body"].split("<br>");
    const words = paragraphs[paragraphs.length - 2].trim().split(" ");

    result["reporter"] = words[0];
    result["mail"] = words[2];

    return result;
  }
}

new JoongangNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("joongang.json", JSON.stringify(articles, null, 2));
});
