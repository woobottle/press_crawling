import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";

class DongaNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];

    let isDone = false;
    for (let i = 0; !isDone; ++i) {
      const articleUrls = await this.crawlArticleUrls(
        `https://www.donga.com/news/List/Politics?p=${
          i * 20 + 1
        }&prod=news&ymd=&m=NP`
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

    const list = $("#content");
    const count = list.children().length;

    for (let i = 3; i <= count - 2; ++i) {
      const obj = {};

      obj["link"] = list
        .find(`div:nth-child(${i}) > div.rightList > a`)
        .prop("href");
      obj["date"] = new Date(
        list.find(`div:nth-child(${i}) > div.rightList > a > span.date`).text()
      );

      //   obj["link"] = new URL(obj["link"], url).href;

      result.push(obj);
    }

    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const result = {};

    result["press"] = "donga";
    result["url"] = url;
    result["headline"] = $("#container > div.article_title > h1").text().trim();
    result["subtitle"] = $("#content > div > div.article_txt > strong")
      .text()
      .trim();
    result["time"] = $(
      "#container > div.article_title > div.title_foot > span:nth-child(2)"
    )
      .text()
      .trim();
    result["modifiedtime"] = $(
      "#container > div.article_title > div.title_foot > span:nth-child(3)"
    )
      .text()
      .trim();
    result["body"] = $("#content > div > div.article_txt").html().trim();

    // result["reporter"] = $("#a-left-scroll-in > div.article-text > div > div.text").contents().eq(-2).text().trim();
    // result["mail"] = $("#a-left-scroll-in > div.article-text > div > div.text > a").text().trim();

    return result;
  }
}

new DongaNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("donga.json", JSON.stringify(articles, null, 2));
});
