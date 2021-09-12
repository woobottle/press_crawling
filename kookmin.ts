import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import * as iconv from "iconv-lite";
import v from "voca";
import moment from "moment";

declare module "axios" {
  export interface AxiosRequestConfig {
    responseEncoding?: string;
  }
}

class KookminNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const categories = [
      ["정치", "pol"],
      ["경제", "eco"],
      ["사회", "soc"],
      ["국제", "int"],
    ];

    const date = moment().format("YYYYMMDD");
    const result = [];

    for (const [categoryName, category] of categories) {
      let isDone = false;
      for (let i = 1; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(
          `http://news.kmib.co.kr/article/list.asp?sid1=${category}&sid2=&page=${i}&sdate=${date}&st=`
        );

        for (let { link, image } of articleUrls) {
          result.push(await this.getArticle(link, categoryName, image));
        }

        if(articleUrls.length !== 40) {
          isDone = true;
          break;
        } 
      }
    }

    return result;
  }

  private async crawlArticleUrls(url: string) {
    const result = [];
    const response = await axios.request({
      method: "GET",
      url: url,
      responseType: "arraybuffer",
      responseEncoding: "binary",
    });
    
    const decodeType = "euc-kr";
    const $ = cheerio.load(iconv.decode(response.data, decodeType));
    const list = $(".nws_list");
    const count = list[0].children.filter((el) => el.type === "tag").length;
    
    for (let i = 1; i <= count; ++i) {
      const obj = {};
      obj["link"] = `http://news.kmib.co.kr/article/${list
        .find(`div:nth-child(${i}) > dl.nws > dt > a`)
        .attr("href")}`;
      obj["date"] = new Date(
        list.find(`div:nth-child(${i}) > dl.nws > dd.date`).text()
      );
      obj["image"] = list.find(
        `div:nth-child(${i}) > p.pic > a > img`
      )[0]?.attribs?.src || '';

      console.log(i, list
        .find(`div:nth-child(${i}) > dl.nws > dt > a`)
        .attr("href"));
      result.push(obj);
    }

    return result;
  }

  private async getArticle(url: string, categoryName, image: string) {
    const response = await axios.request({
      method: "GET",
      url: url,
      responseType: "arraybuffer",
      responseEncoding: "binary",
    });

    const decodeType = "euc-kr";
    const $ = cheerio.load(iconv.decode(response.data, decodeType));
    
    const emailRegex =
      /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
    const reporterRegex = /\S* 기자$/g;
    const result = {};
    result["press"] = "kookmin";
    result["url"] = url;
    result["category_name"] = categoryName;
    result["image"] = image;
    result["headline"] = $("meta[name='title']")[0].attribs.content;

    const [createdAt, modifiedAt] = $(".nwsti_btm > .date").text().trim().split("/");
    result["createdAt"] = createdAt;
    result["modifiedAt"] = modifiedAt;
    
    result["reporterName"] = $("meta[property='dable:author']")[0].attribs.content + "기자";
    result["mail"] = "";

    ["style", "script", "figcaption", "img[alt='국민일보 신문구독']"].forEach(
      (el) => $(el).remove()
    );
    const temp = v.stripTags(
      $(".nws_arti > #articleBody").html(),
      ["img", "span"],
      "<br>"
    );
    const paragraphs = temp
      .replaceAll("<b>", "")
      .replaceAll("</b>", "")
      .replaceAll("<span>", "")
      .replaceAll("</span>", "")
      .trim()
      .replaceAll("&nbsp;", "");
    
      const regex = /src\s*=\s*"([^"]+)"/;
      result["paragraphs"] = paragraphs
      .split("<br><br>")
      .map((el) => el.replaceAll("<br>", ""))
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
      })
      .filter((el) => el !== "");

    return result;
  }
}

new KookminNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("kookmin.json", JSON.stringify(articles, null, 2));
});
