import requests
from bs4 import BeautifulSoup
import json
import time
from urllib.parse import urljoin


BASE_URL = "https://www.vtc.edu.hk"
START_URL = "https://www.vtc.edu.hk/admission/tc/s6/?tab=diploma-of-foundation-studies"


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def parse_page_content(soup):
  
    inner_info = {}

    
    advantage_section = soup.find(id="Advantage")
    if advantage_section:
        advantages = []
        cards = advantage_section.select(".advantage-grid .advantage-card")
        for card in cards:
            h3 = card.find("h3").get_text(strip=True) if card.find("h3") else ""
            p = card.find("p").get_text(strip=True) if card.find("p") else ""
            if h3:
                advantages.append({"title": h3, "description": p})
        inner_info["course_advantages"] = advantages

    
    basic_info_section = soup.find(id="BasicInfo")
    if basic_info_section:
        desc = basic_info_section.find(class_="description-section")
        inner_info["description"] = desc.get_text(strip=True) if desc else ""

        info_items = basic_info_section.select(".info-grid .info-item")
        grid_data = {}
        for item in info_items:
            label = item.find(class_="label").get_text(strip=True) if item.find(class_="label") else ""
            value = item.find(class_="value").get_text(separator=" | ", strip=True) if item.find(class_="value") else ""
            if label:
                grid_data[label] = value
        inner_info["basic_grid_data"] = grid_data

        remark = basic_info_section.find(class_="remark-content")
        inner_info["basic_info_remarks"] = [li.get_text(strip=True) for li in remark.find_all("li")] if remark else []

    
    admission_section = soup.find(id="AdmissionRequirements")
    if admission_section:
        req_list = admission_section.select(".admission-content-detail .richtext ul li")
        inner_info["admission_requirements"] = [li.get_text(strip=True) for li in req_list]

    
    further_ed_section = soup.find(id="FurtherEducation")
    if further_ed_section:
        further_data = {}
        titles = further_ed_section.select(".section-group .h3")
        descs = further_ed_section.select(".section-group .desc")
        for t, d in zip(titles, descs):
            further_data[t.get_text(strip=True)] = d.get_text(strip=True)
        inner_info["further_education_and_career"] = further_data

    
    course_content_section = soup.find(id="CourseContent")
    if course_content_section:
        modules = course_content_section.select(".accordion-content .richtext ul li")
        inner_info["course_modules"] = [li.get_text(strip=True) for li in modules]

        remark = course_content_section.find(class_="remark-content")
        inner_info["course_content_remarks"] = [li.get_text(strip=True) for li in remark.find_all("li")] if remark else []

    
    fees_section = soup.find(id="FeesAndFunding")
    if fees_section:
        fee_amt = fees_section.find(class_="fee-amount")
        inner_info["tuition_fee"] = fee_amt.get_text(strip=True) if fee_amt else ""

        remark = fees_section.find(class_="remark-content")
        inner_info["tuition_remarks"] = [li.get_text(strip=True) for li in remark.find_all("li")] if remark else []

    
    sharing_section = soup.find(class_="sharing-swiper")
    if sharing_section:
        shares = []
        slides = sharing_section.select(".swiper-slide")
        for slide in slides:
            name = slide.find(class_="sharer-name").get_text(strip=True) if slide.find(class_="sharer-name") else ""
            title = slide.find(class_="sharer-title").get_text(strip=True) if slide.find(class_="sharer-title") else ""
            comment = slide.find(class_="description").get_text(strip=True) if slide.find(class_="description") else ""
            if name:
                shares.append({"student_name": name, "title": title, "sharing_content": comment})
        inner_info["student_sharings"] = shares

    return inner_info

def fetch_soup(url):

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.encoding = 'utf-8'
        if response.status_code == 200:
            return BeautifulSoup(response.text, 'html.parser')
        else:
            print(f"  [警告] 無法讀取網頁 {url}，狀態碼: {response.status_code}")
    except Exception as e:
        print(f"  [錯誤] 請求網頁失敗 {url}: {e}")
    return None

def main():
    print(f"正在請求主網頁: {START_URL}")
    main_soup = fetch_soup(START_URL)
    if not main_soup:
        print("無法加載主網頁，程式結束。")
        return

    course_items = main_soup.find_all(class_='course-item')
    print(f"成功找到 {len(course_items)} 個課程項目，開始進行過濾與雙語深挖爬取...\n")

    all_tc_courses = []
    all_en_courses = []

    for item in course_items:
        course_no = item.find(class_='course-no').get_text(strip=True) if item.find(class_='course-no') else ""
        course_name_main = item.find(class_='course-name').get_text(strip=True) if item.find(class_='course-name') else ""
        course_location_main = item.find(class_='course-location').get_text(strip=True) if item.find(class_='course-location') else ""

        
        has_ive = "IVE" in course_location_main or "IVE" in course_name_main
        has_iit = "IIT" in course_location_main or "IIT" in course_name_main

        if has_ive or has_iit:
            
            if has_ive and has_iit:
                org_tag = "[IVE & IIT]"
            elif has_iit:
                org_tag = "[IIT]"
            else:
                org_tag = "[IVE]"

            print(f"發現目標課程 {org_tag}: {course_name_main} ({course_no}) - 地點: {course_location_main}")

            
            url_anchor = item.find(class_='course-url').find('a') if item.find(class_='course-url') else None
            relative_url_tc = url_anchor['href'] if url_anchor and url_anchor.has_attr('href') else ""
            full_detail_url_tc = urljoin(BASE_URL, relative_url_tc) if relative_url_tc else ""

            if full_detail_url_tc:
                
                time.sleep(1.2)
                print(f"  --> 正在爬取中文詳情內頁: {full_detail_url_tc}")
                soup_tc = fetch_soup(full_detail_url_tc)

                if soup_tc:
                    course_title_tc = soup_tc.find(class_="course-title").get_text(strip=True) if soup_tc.find(class_="course-title") else course_name_main
                    tc_info = parse_page_content(soup_tc)

                    all_tc_courses.append({
                        "institution": org_tag.replace("[", "").replace("]", ""),
                        "course_no": course_no,
                        "course_name": course_title_tc,
                        "course_location": course_location_main,
                        "detail_page_url": full_detail_url_tc,
                        "detailed_information": tc_info
                    })
                    print("  [繁體中文版] 資料整合完成")

                    
                    relative_url_en = ""
                    switcher = soup_tc.find("ul", class_="language-switcher")
                    if switcher:
                        for a_tag in switcher.find_all("a"):
                            text = a_tag.get_text()
                            if "EN" in text:
                                relative_url_en = a_tag.get('href', '')
                                break 

                    full_detail_url_en = urljoin(BASE_URL, relative_url_en) if relative_url_en else ""

                    
                    if full_detail_url_en:
                        time.sleep(1.2)
                        print(f"  --> 正在爬取英文詳情內頁: {full_detail_url_en}")
                        soup_en = fetch_soup(full_detail_url_en)
                        if soup_en:
                            course_title_en = soup_en.find(class_="course-title").get_text(strip=True) if soup_en.find(class_="course-title") else ""
                            en_info = parse_page_content(soup_en)

                            all_en_courses.append({
                                "institution": org_tag.replace("[", "").replace("]", ""),
                                "course_no": course_no,
                                "course_name": course_title_en,
                                "detail_page_url": full_detail_url_en,
                                "detailed_information": en_info
                            })
                            print("  [英文版] 資料整合完成")

            print(f"已完成「{course_no}」的繁、英雙語資料對接。\n")

    
    output_tc = "../database/IVE_f_courses_CHI.json"
    output_en = "../database/IVE_f_courses_ENG.json"

    with open(output_tc, "w", encoding="utf-8") as f_tc:
        json.dump(all_tc_courses, f_tc, ensure_ascii=False, indent=4)

    with open(output_en, "w", encoding="utf-8") as f_en:
        json.dump(all_en_courses, f_en, ensure_ascii=False, indent=4)

    print("-" * 50)
    print("所有任務完成！")
    print(f"繁體中文版: {output_tc} (共 {len(all_tc_courses)} 筆)")
    print(f"英文版: {output_en} (共 {len(all_en_courses)} 筆)")

if __name__ == "__main__":
    main()