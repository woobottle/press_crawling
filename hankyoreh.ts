import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";

class HaniNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];

    let isDone = false;
    for (let i = 1; !isDone; ++i) {
      const articleUrls = await this.crawlArticleUrls(
        `https://www.hani.co.kr/arti/politics/list${i}.html`
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

    const list = $("#section-left-scroll-in > div.section-list-area");
    const count = list.children().length;

    for (let i = 2; i <= count; ++i) {
      const obj = {};

      obj["link"] = list
        .find(`div:nth-child(${i}) > div > h4 > a`)
        .prop("href");
      obj["date"] = new Date(
        list.find(`div:nth-child(${i}) > div > p > span`).text()
      );

      obj["link"] = new URL(obj["link"], url).href;

      result.push(obj);
    }

    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const result = {};

    result["press"] = "hani";
    result["url"] = url;
    result["headline"] = $("#article_view_headline > h4 > span").text().trim();
    result["subtitle"] = $(
      "#a-left-scroll-in > div.article-text > div > div.subtitle"
    )
      .text()
      .trim();
    result["time"] = $(
      "#article_view_headline > p.date-time > span:nth-child(1)"
    )
      .text()
      .trim();
    result["modifiedtime"] = $(
      "#article_view_headline > p.date-time > span:nth-child(2)"
    )
      .text()
      .trim();
    result["body"] = $("#a-left-scroll-in > div.article-text > div > div.text")
      .html()
      .trim();

    result["reporter"] = $(
      "#a-left-scroll-in > div.article-text > div > div.text"
    )
      .contents()
      .eq(-2)
      .text()
      .trim();
    result["mail"] = $(
      "#a-left-scroll-in > div.article-text > div > div.text > a"
    )
      .text()
      .trim();

    return result;
  }
}

new HaniNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("hankyoreh.json", JSON.stringify(articles, null, 2));
});
