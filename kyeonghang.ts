import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import * as iconv from "iconv-lite";

declare module "axios" {
  export interface AxiosRequestConfig {
    responseEncoding?: string;
  }
}

class KhanNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const categories = ["politics", "national", "world", ];

    'http://biz.khan.co.kr/khan_art_list.html?category=economy&page=1'
    
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];

    let isDone = false;
    for (let i = 1; !isDone; ++i) {
      const articleUrls = await this.crawlArticleUrls(
        `http://news.khan.co.kr/kh_news/khan_art_list.html?code=910000&page=${i}`
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

    const list = $("#listWrap > div > div.news_list > ul");
    const count = list.children().length;

    for (let i = 1; i <= count; ++i) {
      const obj = {};

      obj["link"] = list.find(`li:nth-child(${i}) > strong > a`).prop("href");
      obj["date"] = new Date(
        list.find(`li:nth-child(${i}) > span.byline > em.letter`).text()
      );

      obj["link"] = new URL(obj["link"], url).href;

      result.push(obj);
    }

    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.request({
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
    result["time"] = $(
      "#container > div.art_header.borderless > div.function_wrap > div.pagecontrol > div > em:nth-child(1)"
    )
      .text()
      .trim();
    result["modifiedtime"] = $(
      "#container > div.art_header.borderless > div.function_wrap > div.pagecontrol > div > em:nth-child(2)"
    )
      .text()
      .trim();
    result["body"] = $("#articleBody").html().trim();

    const line = $(
      "#container > div.art_header.borderless > div.subject > span > a"
    )
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
