import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import v from "voca";

class DongaNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const categories = ["Society", "Economy", "Politics", "Inter"]

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];
    for (const category of categories) {
      let isDone = false;
      for (let i = 0; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(
          `https://www.donga.com/news/${category}/List?p=${
            i * 20 + 1
          }&prod=news&ymd=&m=`
        );
        for (let { link, date } of articleUrls) {
          if (date < dateLimit) {
            isDone = true;
            break;
          }
          
          console.log(link, date);
          result.push(await this.getArticle(link));
        }
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
      const link = list
        .find(`div:nth-child(${i}) > div.rightList > a`)
        .prop("href");

      obj["link"] = link;
      obj["date"] = new Date(
        list.find(`div:nth-child(${i}) > div.rightList > a > span.date`).text()
      );

      const hasAdjustCategory =
        !link.includes("/Sports") && !link.includes("/Entertainment");
      
      if (hasAdjustCategory) {
        result.push(obj);
      }
    }

    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const emailRegex = /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
    const result = {};

    result["press"] = "donga";
    result["url"] = url;
    result["headline"] = $("#container > div.article_title > h1").text().trim();
    result["subtitle"] = $("#content > div > div.article_txt > strong").text().trim().replaceAll('\n', '');
    result["createdAt"] = $("#container > div.article_title > div.title_foot > span:nth-child(2)").text().trim();
    result["modifiedAt"] = $("#container > div.article_title > div.title_foot > span:nth-child(3)").text().trim();
    result["image"] = $("#content > div > div.article_txt > .articlePhotoC > .thumb > img")[0]?.attribs?.src;
    const [ reporterName, , reporterMail ] = $("meta[property='dd:author']")[0]?.attribs?.content?.split(" ");
    result["reporterName"] = reporterName;
    result["mail"] = reporterMail?.replace("??????", "") || '';

    [".armerica_ban", ".article_relation", ".center_ban", ".right_ban", ".txt_ban",
      ".btn_page", "#bestnews_layer", ".article_keyword", "script",".sub_title",
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
      .filter((el) => el !== '')
      .map((el) => {
        if (el.indexOf("src")) {
          const src = regex.exec(el);
          if (src) {
            el = src[1];
          }
        }
        return el;
      })
      
    
    return result;
  }
}

new DongaNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("donga.json", JSON.stringify(articles, null, 2));
});

