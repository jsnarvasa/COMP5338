/*
Author:     Jesse Serina Narvasa
Student ID: 500525438
UniKey:     jnar3156
*/

chosen_hash_tag = args

// static vars
const DATABASE = 'a1'
const MODIFIED_TWEETS_COLL = 'jnar3156_tweets'
const MODIFIED_USERS_COLL = 'jnar3156_users'

// create connection
conn = new Mongo();
db = conn.getDB(DATABASE);


// duplicate the collections for tweets and users with modifications
db.tweets.aggregate([
    {$project: {
        _id: '$id',
        created_at: {$toDate: '$created_at'},
        text: 1,
        user_id: 1,
        retweet_id: 1,
        retweet_user_id: 1,
        replyto_id: 1,
        replyto_user_id: 1,
        user_mentions: 1,
        hash_tags: 1
    }},
    {$out: MODIFIED_TWEETS_COLL}
])
print(MODIFIED_TWEETS_COLL + " has been created successfully")


db.users.aggregate([
    {$project: {
        _id: '$id',
        name: 1,
        screen_name: 1,
        location: 1,
        description: 1,
        created_at: 1,
        favourites_count: 1,
        friends_count: 1,
        followers_count: 1
    }},
    {$out: MODIFIED_USERS_COLL}
])
print(MODIFIED_USERS_COLL + " has been created successfully")


// Creating the indexes
db.jnar3156_tweets.createIndex({retweet_id:1});
db.jnar3156_tweets.createIndex({replyto_id:1});
db.jnar3156_tweets.createIndex(
    {'hash_tags.text':1},
    {partialFilterExpression: {
        'hash_tags.text': {$exists: true}
    }
});


// Question 1
// Find num of general tweets with at least one reply and one retweet in dataset
var start = new Date()

cursor = db.jnar3156_tweets.aggregate([
    // capturing just the general tweets
    {$match: {
        $and: [
            {retweet_id: {$exists: false}},
            {replyto_id: {$exists: false}}
        ]
    }},
    // checking the retweets that occurred for this general tweet
    {$lookup: {
        from: MODIFIED_TWEETS_COLL,
        localField: '_id',
        foreignField: 'retweet_id',
        pipeline: [
            {$project: {_id: 1}}
        ],
        as: 'retweets'
    }},
    // converting array of retweets to count
    {$project: {
        retweet_count: {$size: '$retweets'}
    }},
    // removing general tweets with no retweets
    {$match: {
        retweet_count: {$gt: 0}
    }},
    // performing lookup on the number of reply to the general tweet
    {$lookup: {
        from: MODIFIED_TWEETS_COLL,
        localField: '_id',
        foreignField: 'replyto_id',
        pipeline: [
            {$project: {_id: 1}}
        ],
        as: 'reply_tweets'
    }},
    // converting the array of reply tweets to count
    {$project: {
        retweet_count: 1,
        reply_count: {$size: '$reply_tweets'}
    }},
    // only keeping the general tweets with at least 1 reply tweet
    // note at this point, all the tweets here already have at least 1 retweet
    {$match: {
        reply_count: {$gt: 0}
    }},
    // Perform count of total general tweets with at least 1 retweet and reply
    {$count: 'Number of general tweets'}
])

var end = new Date()


print("Q1 ====================")
print("Execution time: " + (end - start) + "ms")
while ( cursor.hasNext() ) {
    printjson( cursor.next() );
}
print("\n")


// Question 2
// Find the reply tweet that has the most retweets
var start = new Date()

cursor = db.jnar3156_tweets.aggregate([
    // make sure that the docs are reply tweets, by checking for this field
    {$match: {
        replyto_id: {$ne: null}
    }},
    // now that we have all the reply tweets, do a join so we have an array of tweets
    // which are a retweet of the reply tweet
    // hence why the foreignField has to be retweet_id to the id
    {$lookup: {
        from: MODIFIED_TWEETS_COLL,
        localField: '_id',
        foreignField: 'retweet_id',
        pipeline: [
            {$project: {_id: 1}}
        ],
        as: 'retweets'
    }},
    // do a count
    {$project: {_id: 1, retweet_count: {$size: '$retweets'}}},
    // sort and limit to the highest
    {$sort: {retweet_count: -1}},
    {$limit: 1}
])

var end = new Date()


print("Q2 ====================")
print("Execution time: " + (end - start) + "ms")
while ( cursor.hasNext() ) {
    printjson( cursor.next() );
}
print("\n")


// Question 3
// Find the top 5 hashtags, appearing as the first hashtag in a general or reply tweet, ignoring the case of the hashtag
var start = new Date()

cursor = db.jnar3156_tweets.aggregate([
    {$match: {
        $and: [
            // making sure that the tweet has a hashtag
            {hash_tags: {$exists: true}},
            // making sure that the tweet is either general or reply tweet
            {$or: [
                // catching the general tweet
                {$and: [
                    {replyto_id: {$exists: false}},
                    {retweet_id: {$exists: false}}
                ]},
                // catching the reply tweet
                {replyto_id: {$ne: null}}
            ]}
        ]
    }},
    // only get the first hashtag element within each tweet
    {$project: {
        hash_tags: {$first: '$hash_tags.text'}
    }},
    // group by the hashtag text
    {$group: {
        // making sure to set the $toLower command, to ensure that all hashtags are treated as lowercase
        _id: {$toLower: '$hash_tags'},
        count: {$sum: 1}
    }},
    // sort and limit
    {$sort: {count: -1}},
    {$limit: 5}
])

var end = new Date()


print("Q3 ====================")
print("Execution time: " + (end - start) + "ms")
while ( cursor.hasNext() ) {
    printjson( cursor.next() );
}
print("\n")


// Question 4
var start = new Date()

cursor = db.jnar3156_tweets.aggregate([
    // only keeping the tweets that has the hashtag we're after
    {$match: {'hash_tags.text': chosen_hash_tag}},
    // unwinding the user_mentions field array
    {$unwind: '$user_mentions'},
    // performing grouping so that we get a unique list of user mentions
    {$group: {
        _id: '$user_mentions.id',
    }},
    // performing a lookup to get the follower counts of the users
    // note we are loading all the details here
    {$lookup: {
        from: MODIFIED_USERS_COLL,
        localField: '_id',
        foreignField: '_id',
        pipeline: [
            {$project: {
                name: 1,
                location: 1,
                followers_count: 1
            }}
        ],
        as: 'profile'
    }},
    {$sort: {'profile.0.followers_count': -1}},
    {$limit: 5},
    // move the profile field to be the top-level doc
    {$replaceRoot: {
      newRoot: {$first: '$profile'}
    }}
])

var end = new Date()

print("Q4 ====================")
print("Execution time: " + (end - start) + "ms")
while ( cursor.hasNext() ) {
    printjson( cursor.next() );
}
print("\n")


// Creating the indexes
db.jnar3156_users.createIndex({description:1},
    {partialFilterExpression: {
            description: {$eq: ''}
        }
    }
);

db.jnar3156_users.createIndex({location:1},
    {partialFilterExpression: {
            location: {$eq: ''}
        }
    }
);

db.jnar3156_tweets.createIndex({user_id:1});


// Question 5
// Find the number of general tweets published by users with neither location nor description
// Might want to index user_id here
var start = new Date()

cursor = db.jnar3156_users.aggregate([
    // matching with the users whom don't have location and description set
    {$match: {
        $and: [
            {location: {$eq: ''}},
            {description: {$eq: ''}}
        ]
    }},
    // getting the general tweets created by these users
    {$lookup: {
        from: MODIFIED_TWEETS_COLL,
        localField: '_id',
        foreignField: 'user_id',
        pipeline: [
            {$match: {
                // only capturing the general tweets
                $and: [
                    {retweet_id: {$exists: false}},
                    {replyto_id: {$exists: false}}
                ]
            }}
        ],
        as: 'tweets'
    }},
    // getting the number of general tweets made by each user
    {$project: {
        num_of_general_tweets: {$size: '$tweets'}
    }},
    // obtaining the sum of tweets made by all users
    {$group: {
        _id: null,
        total_tweets: {$sum: '$num_of_general_tweets'}
    }},
    {$project: {total_tweets: 1, _id: 0}}
])

var end = new Date()


print("Q5 ====================")
print("Execution time: " + (end - start) + "ms")
while ( cursor.hasNext() ) {
    printjson( cursor.next() );
}
print("\n")


// Question 6
var start = new Date()

cursor = db.jnar3156_tweets.aggregate([
    // performing match to get the general tweets
    {$match: {
        $and: [
            {retweet_id: {$exists: false}},
            {replyto_id: {$exists: false}}
        ]
    }},
    // doing a lookup to check the retweets of the general tweets
    // ensuring that it's within an hour
    {$lookup: {
        from: MODIFIED_TWEETS_COLL,
        localField: '_id',
        foreignField: 'retweet_id',
        let: {general_tweet_creation_hour: {$add: ['$created_at', 60*60*1000]}},
        pipeline: [
            {$match: {
                $expr: {
                    $lte: ['$created_at', '$$general_tweet_creation_hour']
                }
            }},
            {$project: {created_at: 1, _id: 0}}
        ],
        as: 'retweets'
    }},
    // getting the number of retweets per general tweet
    {$project: {
        number_of_retweets: {$size: '$retweets'}
    }},
    {$sort: {number_of_retweets: -1}},
    {$limit: 1}
])

var end = new Date()


print("Q6 ====================")
print("Execution time: " + (end - start) + "ms")
while ( cursor.hasNext() ) {
    printjson( cursor.next() );
}
print("\n")


// Question 4 - Alternative
var start = new Date()

cursor = db.jnar3156_tweets.aggregate([
    {$match: {'hash_tags.text': chosen_hash_tag}},
    {$unwind: '$user_mentions'},
    {$group: {
        _id: '$user_mentions.id',
    }},
    // here, we take note that we only project the followers_count
    // and leaving location and name for later
    {$lookup: {
        from: MODIFIED_USERS_COLL,
        localField: '_id',
        foreignField: '_id',
        pipeline: [
            {$project: {
                followers_count: 1,
                _id: 0
            }}
        ],
        as: 'user_follower_count'
    }},
    {$sort: {'user_follower_count.0.followers_count': -1}},
    {$limit: 5},
    // location and name are only loaded into the pipeline after we get the top 5 users we're after
    {$lookup: {
        from: MODIFIED_USERS_COLL,
        localField: '_id',
        foreignField: '_id',
        pipeline: [
            {$project: {
                name: 1,
                location: 1,
                followers_count: 1
            }}
        ],
        as: 'profile'
    }},
    // replace the root, since we just need to print the profile details,
    // which are also provided from the lookup
    {$replaceRoot: {
      newRoot: {$first: '$profile'}
    }}
])

var end = new Date()

print("Q4 Alternative ========")
print("Execution time: " + (end - start) + "ms")
while ( cursor.hasNext() ) {
    printjson( cursor.next() );
}
print("\n")


// Question 6 - Alternative
var start = new Date()

cursor = db.jnar3156_tweets.aggregate([
    {$match: {
        $and: [
            {retweet_id: {$exists: false}},
            {replyto_id: {$exists: false}}
        ]
    }},
    {$lookup: {
        from: MODIFIED_TWEETS_COLL,
        localField: '_id',
        foreignField: 'retweet_id',
        let: {general_tweet_creation_hour: {$add: ['$created_at', 60*60*1000]}},
        pipeline: [
            {$match: {
                $expr: {
                    $lte: ['$created_at', '$$general_tweet_creation_hour']
                }
            }},
            {$project: {created_at: 1, _id: 0}}
        ],
        as: 'retweets'
    }},
    // unwind and group stages are used to replace the project stage
    {$unwind: '$retweets'},
    {$group: {
        _id: '$_id',
        number_of_retweets: {$sum: 1}
    }},
    {$sort: {number_of_retweets: -1}},
    {$limit: 1}
])

var end = new Date()


print("Q6 Alternative ========")
print("Execution time: " + (end - start) + "ms")
while ( cursor.hasNext() ) {
    printjson( cursor.next() );
}
print("\n")



// Cleanup - remove traces of the duplicated collections
db.jnar3156_tweets.drop()
print(MODIFIED_TWEETS_COLL + " has been dropped successfully")
db.jnar3156_users.drop()
print(MODIFIED_USERS_COLL + " has been dropped successfully")