import urllib.request

def download_image(url, save_as):
    urllib.request.urlretrieve(url, save_as)

image_url = 'http://localhost:5000/video'
save_as = 'image.jpg'

download_image(image_url, save_as)