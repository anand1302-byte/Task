from flask import Flask, render_template, request, redirect, url_for, jsonify
# from flask_pymongo import PyMongo
from pymongo import MongoClient
from bson.objectid import ObjectId

app = Flask(__name__)

# MongoDB Configuration

client = MongoClient('mongodb+srv://anandjethava2004:Anand2004@task.l5yjj.mongodb.net/?retryWrites=true&w=majority')
db = client["User-database"]
collection = db["users"]



@app.route('/')
def index():
    names = list(collection.find())
    return render_template('index.html', names=names)


@app.route('/register', methods=['POST'])
def register():
    name = request.form.get('name')
    if name:
        collection.insert_one({"name": name})
    return redirect(url_for('index'))

@app.route('/delete/<id>', methods=['POST'])
def delete(id):
    collection.delete_one({'_id': ObjectId(id)})
    return jsonify({'status': 'success'})

@app.route('/edit/<id>', methods=['POST'])
def edit(id):
    new_name = request.form.get('name')
    if new_name:
        collection.update_one({'_id': ObjectId(id)}, {'$set': {'name': new_name}})
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True)
