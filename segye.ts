import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";

class SegyeNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const politics = [`https://www.segye.com/boxTemplate/news/box/newsList.do?dataPath=&dataId=0101010000000&listSize=15&naviSize=10&page={{page}}&dataType=slist`]; // 정치 
    const society = [`https://segye.com/boxTemplate/society/box/newsList.do?dataPath=&dataId=0101080000000&listSize=15&naviSize=10&page={{page}}&dataType=slist`]; // 사회
    // const world = ['']; // 국제
    const economies = [
        `https://www.segye.com/boxTemplate/newsList/box/newsList.do?dataPath=0101030100000&dataId=0101030100000&listSize=10&naviSize=10&page={{page}}&dataType=list`,
        `https://www.segye.com/boxTemplate/newsList/box/newsList.do?dataPath=0101030300000&dataId=0101030300000&listSize=10&naviSize=10&page={{page}}&dataType=list`,
        `https://www.segye.com/boxTemplate/newsList/box/newsList.do?dataPath=0101030700000&dataId=0101030700000&listSize=10&naviSize=10&page={{page}}&dataType=list`,
    ]; // 경제(일반, 금융*증권, 부동산*건설)
    
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];
    for (const category of [...politics, ...society, ...economies]) {
      let isDone = false;
      // https://www.segye.com/news/politics?page=0
      // https://www.segye.com/news/society?page=0
      for (let i = 0; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(category.replace('{{page}}', `${i}`));

        for (let { link, date } of articleUrls) {
          if (
            date.getMonth() === dateLimit.getMonth() &&
            date.getDate() === dateLimit.getDate()
          ) {
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

    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const list = $("ul.listBox");
    const children = list[0].children.filter((el) => el.type === "tag");
    
    for(const child of children) {
      const obj = {};
      obj["link"] = (child as any).children.filter((el) => el.name === "a")[0].attribs.href;
      obj["date"] = new Date((child as any).children.filter((el) => el.name === "small")[0].children[0].data);
      result.push(obj);
    }

    return result;
  }

  private async getArticle(link: string) {
    const postNumber = link.replace('http://www.segye.com/newsView/', '').replace('/newsView/', '');
    const year = postNumber.slice(0, 4)
    const month = postNumber.slice(4, 6)
    const day = postNumber.slice(6, 8) 
    // const url = `https://www.segye.com/content/html/${year}/${month}/${day}/${postNumber}.json`;
    const url = "https://www.segye.com/newsView/20210809511483.html";
    const result = {};
    
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const result = {};
      // const postData = response.data;
      // const { title, subtitle, dateCreated, dateLastModified, createdBy, createdUserEmail, fileContent } = postData; 

      // result["press"] = "segye";
      // result["url"] = url;
      // result["headline"] = title || "";
      // result["subtitle"] = subtitle || "";
      // result["createdAt"] = dateCreated ? new Date(dateCreated) : "";
      // result["modifiedAt"] = dateLastModified ? new Date(dateLastModified) : "";
      // result["reporterName"] = createdBy;
      // result["mail"] = createdUserEmail;
      // result["paragraphs"] = fileContent;
    } catch (error) {
      // console.log(link);
      // console.log(error);
    }
    
    return result;
  }
}

new SegyeNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("segye.json", JSON.stringify(articles, null, 2));
});
