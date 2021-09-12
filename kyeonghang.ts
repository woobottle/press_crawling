import axios, { AxiosRequestConfig } from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import * as iconv from "iconv-lite";
import v from 'voca';
import moment from 'moment'

declare module "axios" {
  export interface AxiosRequestConfig {
    responseEncoding?: string;
  }
}

class KhanNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
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
        const articleUrls = await this.crawlArticleUrls(
          "https://www.khan.co.kr/SecListData.html",
          category,
          i,
        );
        for (let { link, date } of articleUrls) {
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
      const articleUrls = await this.getEconomyArticleUrls(
        `http://biz.khan.co.kr/khan_art_list.html?category=market&page=${i}`
      );
      for (let { link, date } of articleUrls) {
        if (date < dateLimit) {
          isDone = true;
          break;
        }

        result.push(await this.getArticle(link, "경제", 'economy'));
      }
    }

    return result;
  }

  private async crawlArticleUrls(url: string, category: string, page: number) {
    const result = [];
    const data = `syncType=async&type=${category}&year=2021&month=9&day=&category=&category2=&page=${page}&code=&serial=&search_keyword=`;
    const config: AxiosRequestConfig = {
      method: "post",
      url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      data,
    };
    const response = await axios(config).then((response) => response.data);
    
    const list = response.items
    const count = list.length;

    list.forEach((el, index) => {
      const {art_id, url} = el;
      const obj = {};

      obj["link"] = url;
      obj["date"] = new Date(
        `${art_id.slice(0,4)} ${art_id.slice(4,6)} ${art_id.slice(6,8)} ${art_id.slice(8,10)}:${art_id.slice(10, 12)}`
      );

      obj["link"] = new URL(obj["link"], url).href;

      result.push(obj);
    })

    return result;
  }

  private async getEconomyArticleUrls(url: string) {
    const result = [];
    const response = await axios.get(url);
    
    const $ = cheerio.load(response.data);
    const list = $(".content_Wrap > div.news_list > ul");
    const count = list.children().length;

    for (let i = 1; i <= count; ++i) {
      const obj = {};

      obj["link"] = list.find(`li:nth-child(${i}) > div > strong > a`).prop("href");
      obj["date"] = new Date(
        list.find(`li:nth-child(${i}) > div > span.byline > em.letter`).text()
      );

      obj["link"] = new URL(obj["link"], url).href;

      result.push(obj);
    }

    return result;
  }

  private async getArticle(url: string, categoryName: string, type?: string) {
    const response = await axios.request({
      method: "GET",
      url: url,
      responseType: "arraybuffer",
      responseEncoding: "binary",
    });

    const decodeType = type === 'economy' ? 'euc-kr' : 'utf-8';
    const $ = cheerio.load(iconv.decode(response.data, decodeType));
    const result = {};

    result["press"] = "경향신문";
    result["url"] = url;
    result["headline"] = $(".headline").text().trim();
    result["subtitle"] = "";
    result["createdAt"] = $(
      ".art_header > .function_wrap > .art_info > .byline > em:nth-child(1)"
    )
      .text()
      .trim();
    result["modifiedAt"] = $(
      ".art_header > .function_wrap > .art_info > .byline > em:nth-child(2)"
    )
      .text()
      .trim();
    const [reporterName, reporterMail] = $(
      "meta[property='article:author']"
    )[0].attribs.content.split("/");
    result["reporterName"] = reporterName;
    result["mail"] = reporterMail?.replace("제공", "") || "";
    result["image"] = "https:" + $("#articleBody > div.art_photo > div.art_photo_wrap > picture > img")[0]?.attribs?.src;
    result["category_name"] = categoryName;
    
    ["style", ".iwmads", ".article_bottom_ad", "#ads5PgPv", "script"].forEach((el) =>
      $(el).remove()
    );
    const paragraphs = v.stripTags(
      $(".art_cont > .art_body").html(),
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
            el = `https:${src[1]}`;
          }
        }
        return el;
      });

    return result;
  }
}

new KhanNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("kyeonghang.json", JSON.stringify(articles, null, 2));
});
